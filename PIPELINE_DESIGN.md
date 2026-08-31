# PIPELINE_DESIGN.md

mapterhorn-japan-bridge の生成パイプライン(`hfu/mapterhorn` の `pipelines/` 配下)が
何を、どの順序で、どういう状態遷移で作っているかをまとめたリファレンス。
個別の意思決定の経緯は `DECISIONS.md` を参照。このドキュメントは「今のコードが
実際にどう動くか」の正、`DECISIONS.md` は「なぜそうなったか」の正、という役割分担。

**成立の経緯(2026-08-31)**: このドキュメントが存在しなかったことが、実際に
本番データの誤削除事故(DECISIONS.md D74-D76)の一因になった。パイプラインの
各段階が何を「同じ」とみなし、何を「別」とみなすかという前提が、コードの中に
散在するコメントとしてしか存在せず、横断的な操作(クリーンアップスクリプト等)を
書く際に見落としが生じた。このドキュメントは「ドキュメント化→自己レビュー→
コード照合→バグ修正→ドキュメント反映」というプロセスの一環として作成された。

## 1. ディレクトリの役割

| ディレクトリ | 役割 | 典型的なサイズ |
|---|---|---|
| `source-store/{source}/` | GSI等から取得した生ラスタ(GeoTIFF)。`bounds.csv` に一覧あり | 数百GB |
| `aggregation-store/{aggregation_id}/` | covering(何を作るかの計画)と進捗マーカー。ULIDで世代管理 | 小さい(CSV/空ファイルのみ) |
| `pmtiles-store/` | aggregation・downsamplingの**実データ出力**。世代非依存でフラット | 最大の実データ(現在数百GB) |
| `tmp-store/{aggregation_id}/{item}/` | aggregation_run.py の作業用一時ディレクトリ | 一時的 |
| `bundle-store/` | bundle.py・merge_japan_bundles.py の出力置き場 | 数百GB(一時的) |

**重要**: `pmtiles-store` は**世代(aggregation_id)をまたいで共有**され、かつ**世代間で
一切消去されない**(DECISIONS.md D12 の未解決事項として明記されている)。つまり
「今の aggregation-store の内容」と「pmtiles-store に物理的に存在するファイル」は
常に一致しているとは限らない。何かを削除・整理する際は、必ず**現在の
aggregation-store のcsvファイル名を正とする**か、`check_downsampling_done_integrity.py`
のような既存の照合ツールを使うこと(後述「6. 既知の構造的落とし穴」参照)。

## 2. パイプライン全体の流れ

```
source-store (生ラスタ)
    │
    ▼
[aggregation_covering.py]  --- 新しい aggregation_id (ULID) を発行、covering計画を書く
    │  (aggregation-store/{id}/*-aggregation.csv + *.csv.todo)
    ▼
[aggregation_run.py]  --- reproject → merge → tile を各アイテムに対して実行
    │  (pmtiles-store/ に {z}-{x}-{y}-{child_z}.pmtiles を書く)
    │  (aggregation-store/{id}/*.csv.done を書く)
    ▼
[downsampling_covering.py]  --- 既存世代のズームピラミッドを z8(min_output_zoom定数)まで組む計画を書く
    │  (aggregation-store/{id}/*-downsampling.csv)
    ▼
[downsampling_run.py]  --- 子タイルを合成して1段粗いタイルを作る、を繰り返す
    │  (pmtiles-store/ に追加の {z}-{x}-{y}-{child_z}.pmtiles を書く)
    ▼
[bundle.py]  --- pmtiles-store全体をz6区画(+planet)ごとに集約
    │  (bundle-store/{quadrant}.pmtiles)
    ▼
[merge_japan_bundles.py]  --- 全quadrantを1つの最終pmtilesにまとめる
    │  (bundle-store/mapterhorn-japan-bridge.pmtiles)
    ▼
[rsync to stars]  --- 本番配信サーバへ転送
```

`publish_cycle.py` は downsampling_covering → downsampling_run → bundle → merge → rsync
を1回のロックされたサイクルとして実行する(`aggregation_covering.py`/`aggregation_run.py`
は含まれない——後述の通り常時別プロセスで動かし続ける設計)。

## 3. 各段階の詳細

### 3.1 aggregation_covering.py

- `source-store/*/bounds.csv` を全部読み、各ソースファイルが交差する「macrotile」
  (既定 z12、`utils.macrotile_z`)を計算する
- 同じ組み合わせのソース群を持つ隣接macrotileをまとめて「aggregation item」を作る
  (`get_aggregation_tiles_dfs`、密度に応じて粒度が変わる可変ズーム)
- 出力ファイル名: `aggregation-store/{id}/{z}-{x}-{y}-{child_z}-aggregation.csv`
  - `z,x,y` = aggregation itemの座標(密度に応じて可変。z8〜z12あたりが多い)
  - `child_z` = このアイテムが実際にネイティブ解像度で持つ最大ズーム(macrotile群の
    maxzoomの最大値。**aggregationの「データの深さ」を表す**)
- **`main()` は呼ぶたびに新しい `aggregation_id` (ULID) を発行する** —
  他の covering スクリプト(downsampling_covering.py)と違って**冪等ではない**。
  国土全体のcoveringをやり直したい時以外は呼ばない。
- `write_aggregation_todos()`: 全アイテムに `.todo` を無条件で書く(D51以降、
  「差分だけ書く」フィルタは撤去済み——理由はコード内コメント参照、旧世代との
  比較が誤った基準になっていたため)

### 3.2 aggregation_run.py (state machine)

各アイテムは3つのファイルで状態管理される:
- `{item}-aggregation.csv`: covering が書いた「何を材料にするか」のレシピ(不変)
- `{item}-aggregation.csv.todo`: 「処理対象である」ことを示す空ファイル
- `{item}-aggregation.csv.done`: 「処理済み」を示す空ファイル

`main()` は `.todo` が存在するファイルだけを glob して作業リストにする。
`run(filepath)` は **`.done` の存在だけ**を見て即スキップするかどうかを決める
(内容の新旧・整合性は一切見ない)。つまり:

- `.todo` は無いが `.done` もない → 一生処理されない(covering が再生成した際に
  `.todo` を作り忘れると起こる)
- `.done` があれば、たとえ参照先のファイルが後から消えても**二度と再処理されない**
  (D74-D76 のバグの本質的な原因の一つ——`.done` は「一度成功した」を示すだけで
  「今も有効」を保証しない)

処理本体(`aggregation_reproject.reproject` → `aggregation_merge.merge` →
`aggregation_tile.main`)は `tmp-store/{aggregation_id}/{item}/` を作業領域にする。

**ワーカー数**: `AGGREGATION_WORKERS`(既定4)。`dirty_filepaths` は
`random.shuffle()` される(隣接アイテムが同程度の重さになりがちなので、
ワーカー間の負荷を均すため)。

### 3.3 aggregation_reproject.py — 7段階ソース優先合成の「準備」段階

各アイテムのcsvは複数の `(source, maxzoom)` の組を持つ。`utils.get_grouped_source_items()`
がこれを**優先順位順にグループ化**する(グループの意味は3.4節参照)。

`reproject()` はグループを優先度の高い順に1つずつ処理する:
1. `create_virtual_raster` (`gdalbuildvrt`) でそのグループのソースをまとめる
2. `create_warp` (`gdalwarp -r cubicspline -dstnodata -9999`, EPSG:3857へ) — nodata
   は数値ブレンドされず正しくマスク伝播される(2026-08-30に実地検証済み)
3. `translate` (`gdal_translate ... -of COG`) で `{i}-3857.tiff` に書き出す
4. `contains_nodata_pixels()` でこのグループだけでは埋まらない領域(NODATAが
   残っている)かを判定 → 残っていれば次の優先度グループへ、無ければ**その場で
   打ち切り**(低優先度グループの処理をスキップ、コスト最適化)

**既知の脆弱性(2026-08-30発見)**: `translate()` は `FAIL_ON_WARNING = False`
(モジュール定数、環境変数ではない)のため、`gdal_translate` が実際に失敗しても
例外を出さずに戻る。次の行の `contains_nodata_pixels(out_filepath)` が存在しない
ファイルを開こうとして `RasterioIOError` でクラッシュする——実行環境依存で
再現性が不安定(同一データ・同一コードでも成功したり失敗したりする、
`japan-geotiff-dem` の `gmldem2tif.rb` バグと同種のGDAL不安定性)。
production run でこれが起きると `aggregation_run.py` の `Pool.starmap()` 全体が
クラッシュする(1アイテムだけがスキップされるのではなく、run全体が落ちる)。
**修正候補**: `FAIL_ON_WARNING` を実質的に `True` にするか、`translate()` の
戻り値/出力ファイル存在を明示的に検証してから次に進む。

### 3.4 aggregation_merge.py — 7段階ソース優先合成の「実行」段階

`get_grouped_source_items()` が定義する優先順位(`lineage_inspect.py` の
`GLOBAL_TIER` に明文化されている、mapterhorn-japan-bridge DECISIONS.md D20):

| 優先度 | ソース | 意味 | 解像度目安 |
|---|---|---|---|
| 0 | `jpnational1` | DEM1A(1m、GSIの最高精度) | 1m |
| 1 | `jpnational5` / A | DEM5A | 5m |
| 2 | `jpnational5` / B | DEM5B | 5m |
| 3 | `jpnational5` / C | DEM5C | 5m |
| 4 | `jpnational10` / A | DEM10A | 10m |
| 5 | `jpnational10` / B | DEM10B | 10m |
| 6 | `jpnationalsea` | Copernicus GLO-30(海域フォールバック、2026-08-19導入) | 30m |

**なぜ7段階という特別な構成なのか**: 日本のGSI基盤地図情報は、地域・調査年次に
よって存在する精度が異なる(1mが無い地域は5m、5mも無ければ10m)うえ、同じ
解像度内でも複数の調査時期・出典(A/B/C)が併存しうる。さらに陸上データは
海域を一切カバーしないため、海岸線・沿岸の連続性を保つには専用の海域ソース
(`jpnationalsea`)が最下位優先度として必要になる。この7段階は upstream の
mapterhorn(単一ソース前提)には無い、**日本の地理院データの供給構造そのものに
起因する本プロジェクト固有の要件**であり、`aggregation_merge.py`/
`aggregation_reproject.py`/`lineage_inspect.py` の3箇所に優先順位の知識が
分散している(`GLOBAL_TIER`、`get_grouped_source_items`、ファイル名パターン
`PRODUCT_TYPE_PATTERN`)。**この分散自体が今後のバグの温床になりうるため、
号2では優先順位の定義を単一の場所に集約することを検討する価値がある。**

`merge()` の実処理: 最高優先度のグループのタイルをベースに、512×512ブロック
単位で処理する。ブロック内にNODATA(`-9999`)が残っていれば、優先度が下がる
ごとに埋める(`copy_mask = (merged_tile == -9999) & (current_tile != -9999)`)。
埋めた境界には `gaussian_filter` によるスムージングを適用し、異なる精度・出典の
データが継ぎ目なく見えるようにする(`boundary_tile_blurred` のロジック)。

### 3.5 aggregation_tile.py

`merged-3857.tiff` を 512px ブロックに分割し、terrarium(または `rgb`)エンコード
で `.webp` タイルを書き出し、`utils.create_archive()` で1つの `.pmtiles` に固める。

出力ファイル名: `{out_folder}/{z}-{x}-{y}-{child_z}.pmtiles`
(`out_folder = utils.get_pmtiles_folder(x, y, z)`)。

**stale cleanup(設計意図)**: 同じ `{z}-{x}-{y}` 位置に**別の**`child_z` を持つ
古いファイルが残っていたら削除する、というロジックがある
(`for stale_filepath in glob(f'{out_folder}/{z}-{x}-{y}-*.pmtiles')`)。これは
「同じ位置のソース構成が変わってchild_zが変化した」場合に古い成果物を残さない
ための設計。**2026-08-30の調査(D74)で、pmtiles-store全体の約50%の位置で
このcleanupが機能していないように見える結果が出たが、これはD74自身の監査
スクリプトがaggregation層とdownsampling層の`(z,x,y)`名前空間を1つの辞書に
混同していたこと(D76で判明)が原因だった。2026-08-31、2層を分離し
downsampling層の正当な複数child_z共存(D75)も許容する形で監査スクリプトを
書き直し(`check_stale_duplicates_v2.py`)、pmtiles-store全体を再スキャンした
結果、**真の意味でのstaleファイル・孤児ファイルは0件**だった(D78)。
つまり、このコード自体のcleanupロジックにバグは無かった可能性が高い——
D74の「50%」は監査スクリプト側の誤検出であり、市松模様の原因としては
棄却される(D78参照)。

### 3.6 downsampling_covering.py

既存世代の `*-downsampling.csv` を全消去して**毎回フルに再生成**する(冪等)。
`write_downsampling_items()` は `child_zoom` を **31から `min_output_zoom + 1` まで
降順**にループし(2026-08-30時点 `min_output_zoom = 8`)、各段で1段粗いズームの
タイルを作るための「材料一覧」を書く。

出力ファイル名: `aggregation-store/{id}/{z}-{x}-{y}-{parent_zoom}-downsampling.csv`
(`parent_zoom = child_zoom - 1`。ここでの `z,x,y` は**このアイテムの出力位置**
であり、aggregation_covering.py の `z,x,y`(ソースの実データ位置)とは**別の
座標空間**——数値としてたまたま一致することがある。**D75/D76 で発覚した通り、
この2つの座標空間を同一視して処理すると重大なバグになる。**)

**`min_output_zoom = 8` の意味(2026-08-30変更)**: 元々は0まで(世界全体)ズーム
ピラミッドを作っていたが、深海など真にデータが無い領域の「穴」がz0-7の俯瞰視点
でのみ視覚的に問題になる(z8以上では誰もその場所を見ない)という判断から、
z8で打ち止めにし、z0-7はtiles.mapterhorn.com(グローバルMapterhorn)の成果物を
`pmtiles merge` で後から接合する設計に変更した(後述7節)。

### 3.7 downsampling_run.py (state machine)

aggregation_run.py と同じ `.csv`/`.csv.done` パターン(**`.todo` は使わない**——
`main()` は `*-downsampling.csv` を直接globし、`.done` の有無だけでフィルタする。
`aggregation_covering.py` の `write_downlsampling_todos()` は存在するが
**呼ばれていない・どこからも消費されない死んだコード**、D55参照)。

各アイテムの `.csv` は「子タイルのファイル名一覧」を持つ。`create_tile()` は
参照される全ての子pmtilesを開いて2x2平均を取り、1段粗いタイルを作る。

**`DOWNSAMPLING_STRICT`(既定0=off)**:
- `0`(非strict): 参照される子タイルが一部欠けていても、存在する分だけで
  親タイルを作り `.done` を打つ(警告は出す)。「集計途中の世代で先に低ズームの
  結果を公開したい」用途向けの元々の設計(upstream由来)
- `1`(strict、`publish_cycle.py` が明示的に設定): 参照される子タイルが
  **1つでも**見つからなければ、そのアイテム全体をスキップし `.done` を**打たない**
  (将来のrunで再試行される)。本番公開时の既定はこちら。

**`ChildPmtilesUnavailable`**: `create_tile()` が読み込み中に「参照されている
はずのファイルが見つからない」ケースを検出した時の専用例外。
`aggregation_run.py` の同時実行によるファイルの改名・置き換えレース
(D37/D44)を想定した設計で、`main()` が捕捉してそのアイテムをスキップする
(`.done` を打たない)。

**ワーカー数**: `DOWNSAMPLING_WORKERS`(既定5、`publish_cycle.py` は3を指定)。

**`PRIORITY_MODE`**: `proximity`(既定、Freetown中心からの距離順——このリポジトリの
別プロジェクト向けの元設計)/ `quadrans`(日本向け、南北東西優先、
`publish_cycle.py` が明示的に指定)。処理順序を決めるだけで結果には影響しない。

### 3.8 bundle.py

`pmtiles-store` 全体を素朴に `glob` し(`{z<7}-*.pmtiles` のフラット直下ぶんと
`{z==7}-x-y/` サブフォルダ内の全ファイル)、以下の規則でグルーピングして
1つの `.pmtiles` に集約する(`get_parent_to_filepaths`):

- ファイル名の `child_z`(アーカイブ内タイルの最大ズーム。aggregation出力なら
  ソースのmaxzoom、downsampling出力なら都度のズーム)が **12以下** →
  `planet.pmtiles`(低ズームの俯瞰用アーカイブは全部ここに入る)
- `child_z` が13以上 → ファイル名の `z` が6ならそのまま、7以上ならz6の祖先
  タイルに割り当てて `{6-x-y}.pmtiles` に集約

(コード内コメントに明記の通り、ここでの `child_z` は `utils.macrotile_z`
(covering用の12)とは無関係な、**そのアーカイブ自身が内部に持つタイルの
最大ズーム**を指す——たまたま両方とも12という値を共有しているだけ)

**重要な前提**: bundle.py は「pmtiles-store に存在するファイルは全て有効である」
という前提で動く。stale重複ファイル(3.5節参照)が残っていれば、それも
無条件に取り込んでしまう構造ではある——ただしD78の再監査で真のstale
ファイルが0件と判明したため、**市松模様の原因がここにあるという仮説(D74)は
棄却された**。市松模様の真因は2026-08-31時点でも未特定(D78参照)。

**ワーカー数**: `BUNDLE_WORKERS`(既定4、`publish_cycle.py` は2を指定)。

**`dirty_only`**: D44により撤去済み——毎サイクル必ずフルリビルドする(差分
ビルドは行わない)。

### 3.9 merge_japan_bundles.py

`bundle-store/*.pmtiles`(自分自身の出力ファイル名を除く)を**ファイル名の
アルファベット順**に読み、1つの `mapterhorn-japan-bridge.pmtiles` に連結する。
処理済みの入力ファイルは都度削除する(ディスク容量対策、D49/D53)。

**「clustered」にならない**: PMTilesの `clustered` フラグは「tile_idの昇順で
バイト列が並んでいるか」を意味するが、このスクリプトは**ファイル単位で完結した
書き込み**をアルファベット順に連結するだけで、**グローバルなtile_id順にはならない**。
そのため `pmtiles extract` はこの出力に対して使えない(`must be clustered for
extracts` エラー、実際に確認済み)。カスタムのPythonスクリプト
(`pmtiles.reader.all_tiles()` を使う、本ドキュメント7節参照)で代替する必要がある。

**訂正(2026-08-31、D79/D80と同時期のレビューで発見)**: 上記のextract制限を
「`pmtiles cluster` も同様に使えない」と一般化していたのは誤り。
`pmtiles cluster --help`を確認したところ、**「Cluster an unclustered local
archive」——非clustered化アーカイブをclustered化する**ことがこのコマンド自身の
存在目的であり、事前にclustered化されていることを前提にする道理がない
(それでは何もできなくなる)。実際に`cluster`コマンドをこのプロジェクトの
非clustered出力に対して試した記録はDECISIONS.mdに見当たらず、「使えない」は
`extract`の制限からの類推であって実地検証されていない可能性が高い。
次に`japan-z8plus.pmtiles`を再生成した際、**最終`pmtiles merge`の前に
`pmtiles cluster japan-z8plus.pmtiles`を試す価値がある**——もし機能すれば、
7節で説明している「z0-7ファイル→z8+ファイルの順でmergeすることで副産物的に
clustered化される」という設計をより単純化できる(z8+側単体を先にclustered化
しておけば、そもそも結合順序に依存しなくなる)。

### 3.10 publish_cycle.py — サイクル全体のオーケストレーション

- `fcntl.flock()` による非オーバーラップ制御(実行中に再度呼ばれたら
  即座にスキップ、多重起動しない)
- **`TMPDIR` を明示的に `/Volumes/Migrate-2025-04/tmp` に上書きする**
  (内蔵SSDではなく容量のある方のディスク)——**この上書きが無いと、
  `pmtiles.writer.Writer` が全タイルデータをOS既定の一時ディレクトリ
  (`tempfile.TemporaryFile()`、通常は内蔵SSD側の`/var/folders/.../T`)に
  バッファするため、大規模な出力(数百GB)でENOSPCを起こす。
  2026-08-30、`bundle.py`/`merge_japan_bundles.py` を `publish_cycle.py` を
  経由せず単独実行した際にこれで複数回クラッシュした——原因は
  この`TMPDIR`上書きの欠如だった。単独実行する場合は必ず
  `TMPDIR=/Volumes/Migrate-2025-04/tmp`(または同等の空き容量がある場所)を
  明示的に指定すること。**
- 実行順序: `downsampling_covering.py` → `downsampling_run.py`
  (`PRIORITY_MODE=quadrans`, `DOWNSAMPLING_STRICT=1`, `DOWNSAMPLING_WORKERS=3`)
  → 古い `bundle-store/mapterhorn-japan-bridge.pmtiles` を削除 → `bundle.py`
  (`BUNDLE_WORKERS=2`) → `merge_japan_bundles.py` → stars側の古いファイルを
  削除 → rsync
- `aggregation_covering.py`/`aggregation_run.py` は**このサイクルに含まれない**
  ——常時別のscreenセッションで動かし続ける設計(「pausingは無意味な足止めに
  しかならない」という運用判断、コード内コメント参照)

## 4. なぜ「同じ命名規則」が2つの別レイヤーで使われているのか

`{z}-{x}-{y}-{child_z}` という命名パターンは、aggregation層(ソースの実データ
配置に基づく)と downsampling層(ズームピラミッドの構築段階)の**両方**で
使われているが、**両者の座標系は独立しており、意味も異なる**:

- aggregation の `(z,x,y)`: covering が決めた「データが実際に存在する範囲」の
  グルーピング単位。密度に応じて可変。
- downsampling の `(z,x,y)`: 「これから作る1段粗いタイル」の出力位置。
  ズームレベルごとに規則的。

数値上、同じ `(z,x,y)` が両方のレイヤーに偶然出現することがある
(2026-08-31の実測で6,373件のaggregation位置のうち3,344件がdownsampling層とも
座標が一致していた——全国に一様に分布しており、地域的な偏りは無い)。
**この2つのレイヤーを跨いだ処理を書く際は、必ずレイヤーごとに別の名前空間
(別の辞書・別のプレフィックス)で扱うこと。** これがD74-D76の事故の直接原因。

## 5. 環境変数リファレンス

| 変数 | 既定値 | publish_cycle.pyでの上書き | 影響範囲 |
|---|---|---|---|
| `TILE_ENCODING` | `terrarium` | (無し) | aggregation_reproject/tile, downsampling_run, utils.macrotile_z。`rgb`はorthophoto/Freetown用途、標高データでは絶対に使わない |
| `AGGREGATION_WORKERS` | 4 | (無し) | aggregation_run.py の並列度 |
| `DOWNSAMPLING_WORKERS` | 5 | 3 | downsampling_run.py の並列度 |
| `BUNDLE_WORKERS` | 4 | 2 | bundle.py の並列度 |
| `DOWNSAMPLING_STRICT` | 0 (off) | 1 (on) | 子タイル欠如時にスキップするか、有る分だけで進めるか |
| `PRIORITY_MODE` | `proximity` | `quadrans` | downsampling処理順序(結果には影響しない) |
| `CENTER_LAT`/`CENTER_LON` | Freetown座標 | (無し、quadrans使用時は無効) | proximityモード時のみ意味を持つ |
| `TMPDIR` | OS既定(内蔵SSD) | `/Volumes/Migrate-2025-04/tmp` | **pmtiles.writer.Writerの一時バッファ置き場。単独実行時は要手動指定** |

モジュール定数(環境変数ではないが挙動を左右する、コードを直接編集しないと
変えられない): `aggregation_reproject.py`/`aggregation_merge.py` の
`SILENT`/`FAIL_ON_WARNING`(共にデフォルト `SILENT=True`, `FAIL_ON_WARNING=False`
——3.3節の脆弱性の直接原因)。

## 6. 既知の構造的落とし穴(2026-08-30/31 実地で発見)

1. **`.done`マーカーは「今も有効」を保証しない**(3.2/3.7節)。上流(ソース
   ファイル・aggregation出力)が後から更新されても、`.done`があれば永遠に
   再処理されない。`check_downsampling_done_integrity.py` のような「参照先の
   実在確認」ツールが必要な理由。
2. **pmtiles-storeは世代非依存でフラット、かつ一切消去されない**(D12)。
   stale cleanupが機能しない場合、古い成果物が無期限に残り続ける。
3. **aggregation層とdownsampling層は座標空間が独立しているが、同じ命名規則を
   共有している**(4節)。横断的なツールを書く時は要注意。
4. **`pmtiles.writer.Writer`はタイルデータ全量を`tempfile.TemporaryFile()`に
   バッファしてから最終ファイルにコピーする**。`TMPDIR`を明示しないと
   内蔵SSDの手薄な領域でENOSPCになる(3.10節)。
5. **`gdal_translate`/`gdalwarp`の失敗が`FAIL_ON_WARNING=False`により握り
   つぶされ、後続処理が不可解なクラッシュを起こす**(3.3節)。実行環境依存で
   再現性が不安定。
6. **`merge_japan_bundles.py`の出力はclustered化されない**ため、go-pmtiles
   CLIの`extract`が使えない(3.9節)。ただし`pmtiles cluster`(非clustered
   アーカイブをclustered化するコマンド)は実地検証されておらず、「使えない」
   という記述は誤りだった可能性が高い(3.9節の訂正参照、2026-08-31)。

## 7. z0-7 グローバルMapterhorn接合設計(2026-08-30〜)

**背景**: 自前のaggregationデータは、日本から遠い外洋等に構造的な無データ域が
あり、z0-7の俯瞰視点でのみ視覚的な「穴」として認識される(z8以上では誰も
その場所を見ないため実害が無い)。

**z0-7をMapterhornの汎用データに委ねてよいことのジャスティフィケーション
(GSDによる検証)**: z0-7の範囲でGSIの高精細DEM(最高1m)を使う意味が
あるかどうかは、そのズームのGSD(Ground Sample Distance、1ピクセルが
表す実距離)で判断できる。`downsampling_run.py`の`get_resolution()`が使う
EPSG:3857上の解像度計算(1タイル512px、z0で全世界)から、z7のGSDは:

```
78,271.5 m/px (z0) / 2^7 = 611.5 m/px (EPSG:3857投影上)
```

日本付近(北緯35°)では投影の伸縮を補正すると実距離で約500m/px相当。
GSIの最高精度ソース(jpnational1、1m)を、この500m/pxまで愚直に平均化
すると、1出力ピクセルにつき**約25万個の1mソースピクセル**が畳み込まれる
計算になる。これほどの平均化を経れば、1mソースと(Mapterhornが使う)
Copernicus GLO-30(30m)ソースの違いは、大局的な地形(山塊・盆地の
起伏)の再現においてほぼ吸収され、視覚的に有意な差を生まないと考えられる
——**GSIの精細データの優位性は、ネイティブ解像度に近いズーム(z14〜16
あたり)でこそ意味を持ち、z7以下では実質的に無効化される**、というのが
このジャスティフィケーションの骨子。

**設計**: `downsampling_covering.py`の`min_output_zoom=8`により、自前のズーム
ピラミッドはz8までしか作らない。z0-7は`tiles.mapterhorn.com`
(`{z}/{x}/{y}.webp`、terrarium/webp/tileSize512——自前のエンコーディングと
完全一致)から直接取得し、`global-overview.pmtiles`として保存する
(`build_global_overview.py`、新規スクリプト)。

**最終結合**: z0-7(`global-overview.pmtiles`)とz8+(自前の
`japan-z8plus.pmtiles`)は互いにdisjoint(tile_id空間が重複しない——PMTilesの
tile_id採番はズームごとに単調増加するため、z7の最大tile_id < z8の最小tile_id
が必ず成り立つ)なので、`pmtiles merge`(go-pmtiles CLI、disjoint専用の
マージコマンド)でそのまま結合できる。この結合順序(z0-7ファイル→z8+ファイル)
自体が、副産物として全体をtile_id昇順=clustered化する(6節の問題を回避できる)。

**実地検証(2026-08-31)**: 富士山頂(実標高3,776.24m)を含むz7タイルを
`global-overview.pmtiles`から実際にデコードして確認したところ、タイル内の
ピーク値は**3,662.5m**だった。差(約114m)は、GSD約500m/px(北緯35°付近)の
ピクセルに山頂の鋭いピークが平均化される効果として妥当な範囲——Mapterhorn
単体のデータが実際の地形と矛盾しないことを確認した。自前のGSIデータとの
直接比較(同じ位置のネイティブ解像度ピーク値)も試みたが、該当アイテムが
D74-D76の復旧作業中で該当ファイルを特定できず未実施。ただし上記のGSD計算
とMapterhorn単体の妥当性確認により、ジャスティフィケーション自体は支持
されると判断する。復旧完了後、余裕があれば同一地点での直接比較を追加で
行う価値はある。

**attribution**: Mapterhorn由来のデータを組み込むため、最終成果物の
メタデータに `© Mapterhorn (https://mapterhorn.com/attribution)` を含める必要がある。

**状態(2026-08-31時点)**: `global-overview.pmtiles`は作成・検証済み
(13,524タイル)。z8+側は D74-D76 の事故からの復旧作業中で、まだ完成していない。
最終的な`pmtiles merge`はまだ未実施。

### 7.1 境界ズーム(z7/z8)の妥当性レビュー(2026-08-31、D77)

藤村さんの指摘: 「z7/z8での接合に必然性があるか、グローバルMapterhornの
実践と整合的か、ズームレベルが数個ずれている可能性はないか」を論理的に
詰める。以下、3つの角度から検証した。

**(1) z7は自前パイプライン内で既に構造的境界として使われている**:
`pipelines/utils.py`の`get_pmtiles_folder(x, y, z)`が、`z < 7`はフラットな
`pmtiles-store`直下、`z == 7`はz7タイル単位のフォルダ、`z > 7`はz7祖先で
束ねたフォルダ、という3分岐でpmtiles-storeのディレクトリシャーディングを
決めている。これは全く別の目的(ファイルシステム上の分散)で以前から
存在するコードだが、結果として「z7以下=グローバル粒度」「z8以上=
リージョナル粒度」という区分が、GSDのジャスティフィケーション(7節)とは
独立に、既に自前コードベースの中に存在していたことを意味する。z8を
`min_output_zoom`に選んだことは、この既存の境界と一致しており、恣意的な
選択ではない。

**(2) tiles.mapterhorn.comの実データで境界のズレを検証**: 「グローバル
Mapterhornの実践と整合的か」を確認するため、`tiles.mapterhorn.com`に
実際にHTTPリクエストを投げて実データの被覆状況を調べた。
  - z0(1タイル)・z1(4)・z2(16)は全て200(欠落なし)。
  - z3(64タイル)で初めて欠落が発生(2件: `3/0/0`, `3/1/5`, `3/7/0`は北極圏、
    `3/1/5`は南太平洋の絶海)。
  - 日本近海を含む広めのbbox(東経118-154度、北緯20-50度)で z3〜z7を
    全数チェックしたところ、z3: 0/4、z4: 0/6、z5: 1/20、z6: 12/64、
    **z7: 54/196(27.5%)**が欠落(404)。
  - 欠落タイルの座標を確認したところ、**全て日本海・東シナ海・
    フィリピン海・日本東方の太平洋(伊豆・小笠原方面)などの外洋**で、
    東京・大阪・札幌・福岡・那覇の各都市を含むz7タイルは全て存在した
    (欠落は日本の陸地には一切かかっていない)。
  - `mapterhorn/mapterhorn`本家のCHANGELOG.mdに"Add source coverage vector
    tiles layer (#113)"という記載があり、上流自身が「ソースデータが
    存在する範囲」を別レイヤーとして扱っていることが伺える——つまり
    外洋の無データは実装の不備ではなく、**陸域DEM由来のデータセット
    (Copernicus GLO-30等)に外洋の海底地形が含まれないという、上流も
    前提としている設計**である可能性が高い。

**(3) この検証が示す帰結(z7/z8はズレていないが、副作用がある)**:
z7/z8という境界そのものを動かす根拠は見当たらない——z6に下げても
z8/z9に上げても、上記(2)で見つかった「外洋に本質的にデータが無い」
問題は解消しない(境界をどこに引いても、外洋の無データ域は
Mapterhorn自身のデータにも自前のjpnationalseaデータにも実在しない)。
ただし、これは**接合設計の「必然性が無い」ことを意味するのではなく、
「接合してもなお日本近海に穴が残る」という、事前に明示しておくべき
副作用**である:

- 接合後も、日本海・東シナ海・日本東方の外洋では、z6〜z7で
  最大27.5%程度のタイル欠落が残る(Mapterhorn自身の実データに
  由来する、構造的かつ正当な欠落)。これは今回の作業が解決しようと
  した「世界中どこでも真っ白」という問題(自前データが日本以外
  ゼロ被覆だった問題)とは別種の、より局所的かつ残存する事象であり、
  最終結合後に混同して「まだ直っていない」と誤診しないよう、
  ここに明記しておく。
- z8以上は自前のGSI由来データしか存在しないため、日本国外は
  z8以上で完全に無データとなる。これは本リポジトリのスコープが
  日本国内限定である(README記載、ADR 0001参照)ことと整合的で、
  意図した挙動と判断する。

**結論**: z7/z8の境界設定に論理的な誤り・数ズームのズレは見当たらない。
むしろ既存の`get_pmtiles_folder()`という独立した根拠で裏付けられる。
一方で、接合後も日本近海の外洋には(Mapterhorn自身のデータ限界に
起因する)穴が残ることを検証で確認したため、最終`pmtiles merge`後の
目視確認では、**中国・四国・九州・沖縄の「陸地に近い海岸沿いの
市松模様」(D74-D76が復旧作業の対象。ただしD78によりD74の原因仮説自体は
棄却されており、真因は依然未特定)と、「外洋の構造的な低ズーム欠落」
(本節で確認、修正不能かつ許容範囲)を区別して評価すること**。
