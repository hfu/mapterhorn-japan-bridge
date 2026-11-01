# PLAN-archive.md

Archived, unedited, from `PLAN.md` on 2026-11-01 (D188). Same pattern as
`HANDOVER-archive.md`. The live 2号 runbook is `PLAN.md` section 8; this
is the old section 8 (a 2026-09-06 readiness checklist that kept growing
through 2026-10-01), kept for the history of what was checked and why.

## 8. 2号 launch readiness checklist (2026-09-06 rewrite, post-1.5号)

**この節は2026-09-01時点(「1号完了まで待つ」フェーズ)の古い版を全面刷新したもの。**
当時の「今すぐ着手してよい/1号完了まで待つべき」という枠組みは、1号・1.5号
両方が完了した今では意味をなさない。1.5号自身の存在理由(§6/§9)が「2号では
コードを変更せず高速に流すだけにする」ことだったため、この節は**2号を実際に
起動する前に確認すべきことのチェックリスト**として書き直す。**このセッションでの
作業範囲はこのチェックリストの確認・整理のみ——2号自体の起動(新しい
generation_id発行・aggregation開始)は別セッションで行う合意のまま変更なし。**

**コード面: 実質的に準備完了**
- ✅ D95/D124の名前空間分離(`get_pmtiles_folder()`のlayer/datatype/generation_id分離) — 1.5号で全国スケール実装・検証済み。2号は新しいgeneration_idを発行するだけでよい。
- ✅ lineage機能(D93/D94/D96) — 1.5号で実装・公開済み。D144でclusteringもコードに組み込み済み。
- ✅ lineageの低ズーム拡張(D146、`lineage_extend_low_zoom.py`) — 2号でも標準手順として実行すること(PLAN.md §9参照、実装済み・再現性確認済み)。
- ✅ ワーカー数(`AGGREGATION_WORKERS=3`固定、D131) — コードのデフォルト値として組み込み済み、2号は環境変数指定不要。
- ✅ `bundle.py`のpmtiles-storeレース修正(D37/D44) — 恒久修正済み、2号は自動的に恩恵を受ける。
- ✅ **JGD2011→JGD2024座標系変更(§1で発見、2026-09-07調査・2026-09-09解決・D147)**:
  実データは既に`srsName="fguuid:jgd2024.bl"`だが、EPSGは新コードではなく
  `EPSG:6668`自体を「JGD2011」から「JGD2024」へリネームする形で決着させた
  (`OSGeo/PROJ`コミット`7f1fdb39`、v12.055、2026-04)。番号が変わらないため
  `gmldem2tif.rb`/`aggregation_reproject.py`とも**対応不要**。詳細は
  DECISIONS.md D147の2026-09-09追記参照。

**2026-09-12の再チェックで判明**: 以下2項目のうち1つ(5m/10m破損チェック)は
実際には2026-08-25に既にクローズ済み(D35)だったが、その後の`PLAN.md`更新
セッションで一度も反映されず「未解決」のまま3週間近く放置されていた。§3を
参照して修正済み——このチェックリスト自体、次に触る前に本当に未解決かどうか
D番号まで遡って確認すること(タイトルだけで信用しない)。

**未解決・2号起動前に確認が必要な項目**:
- ✅ **5m/10mデータの破損チェック — 実は2026-08-25(D35)に完了済み(§3参照)**:
  `screen_source.py`で`jpnational10`/`jpnationalsea`は全数ゼロエラー、
  `jpnational5`の2,062件0%validは別現象(正当な空メッシュ)と判明・除外済み。
  2026-09-12にscreen_results_*.csvの生データで再検証し数字が一致することを
  確認済み。**2号起動前の追加作業は不要。**
- ✅ **dirty-tracking(差分再処理)——安全な設計を実装・小規模検証済み(D163、
  2026-09-12)**: D57が撤去した世代間再利用を、D119/D120の`.done`マニフェスト
  フィンガープリント機構を流用して再設計・実装。`aggregation.csv`の内容一致
  だけでなく、各ソースファイル自身のMD5(`file_list.csv.gz`由来)まで突き
  合わせ、かつ前世代の出力ファイルが実在することを確認した場合のみ、その
  ファイルを現世代自身のフォルダにコピーして新規`.done`を発行する(前世代への
  裸の参照は一切作らない)。D18/D35型の「同名・同サイズだが中身が違う」ケース
  も明示的にテストし、正しく再利用を拒否することを確認済み。1.5号の全6,373件
  の`.done`マニフェストにもMD5フィンガープリントを後付け済み(`backfill_
  aggregation_md5_fingerprints.py`、バイナリ成果物は一切触れていない)——
  これにより2号は起動した瞬間から1.5号との比較が可能。**小規模(単一/複数
  ソース、両datatype、正常系・異常系)は実データで検証済み。全国規模での
  実地検証は2号自身の起動時が初めて**——詳細はDECISIONS1.md D163参照。
- ⚠️ **GSIの次回更新確認(§1)**: 2026-09-11時点でもまだ2026-07-31が最新
  (新規更新なし、ライブ確認済み)。想定は2026年11月末——起動直前に必ず
  再確認すること。

**2026-09-13、Opusによる本番パイプライン全体の独立レビューで新たに判明
(D165)**: Hidenoriさんの方針(「Claudeの指摘が晴れたらOpusにもレビュー
させる、ドレスリハーサルはバグ潰しが万全になってから」)に沿って実施。
10件の確証済み指摘のうち5件は修正・実データ検証済み
(**うち1件は既に公開中の1.5号データに実害あり**——`aggregation_merge.py`
がnodataを常に偽の標高0mとして0埋めしており、alphaマスク機構が死んでいた。
修正・検証済み。#7の`remove_dangling_pmtiles.py`のD146誤検出もD166で
合わせて修正済み)。残り5件はD167(2026-09-14)で全件修正・実データ検証済み:
- ✅ `aggregation_run.py`の完了判定が鮮度・出力実在を確認しない(D18/D35型
  の再発リスク、#3) → `done_is_current()`+出力実在チェックに修正済み。
- ✅ `downsampling_run.py`の完了判定も同様に自分の出力実在を確認しない(#5)
  → 同様に修正済み。
- ✅ lineageの`compute_provenance()`がラスタ全体を無圧縮でメモリに読み込む
  (最大ワーカー1つで約10.7GiB、D129のクラッシュと同じ機構、#6) →
  512pxウィンドウ処理に書き換え、実データ(5ソース・33018×33018px、約
  10.9億ピクセル)で新旧実装の差分0を確認。1.6号のアップサンプリングで
  一部アイテムが32768×32768pxに達する点を踏まえると、放置していれば
  1.6号でむしろ悪化するところだった。
- ✅ `downsampling_run.py`のtmpフォルダがdatatypeでスコープされていない(#8)
  → 修正済み。
- ✅ 古いcoveringが削除されず、2ワーカーが互いの出力を削除しうる
  (PLAUSIBLE、#10) → 修正済み。**ただし最初の修正案には、同一世代への
  再カバリング実行(変更なしの再実行を含む)のたびに既存アイテム全ての
  `.done`を誤って削除してしまう重大な回帰バグがあり、Opusのコードレビュー
  で実行前に検出・修正**(詳細はDECISIONS1.md D167参照)。

詳細・各項目の対応方針はDECISIONS1.md D165(元の発見)・D167(修正)参照。

**方針転換(2026-09-13、Hidenoriさんの決定)**: 当初想定していた
「大改修→ドレスリハーサル→1.7号」の流れを**「大改修→アップサンプリング
実装→ドレスリハーサル→1.6号」に変更**——1.7号は未発番のまま据え置き、
D149-151で既に使われていた「1.6号」という呼称を次の実launchの正式名称
として確定した。1.6号の「アップサンプリング実装」自体はD166として
実装・設計レビュー・コードレビュー・実データ検証済み(詳細はDECISIONS1.md
D166参照)——当初案(`resolve_layer()`を位置だけで一致判定)はOpusの設計
レビューにより実データで検証した結果、アップサンプル無関係に全国の
downsamplingピラミッドの約半分を壊す設計ミスと判明し、実装前に修正済み。
**`LAND_UPSAMPLE_ZOOM_BY_GENERATION`テーブルは1.6号自身のgeneration_id
発番待ちでまだ空。D165の残り5件は2026-09-14(D167)に全件対応済み——
ドレスリハーサル・1.6号本launchの残る前提条件はこのID発番のみ**、という
のがHidenoriさんの指示した流れ。

**2号起動前に片付ける小口の整理(D160、2026-09-11)**:
いずれも2号の成否を左右するものではないが、放置すると次のセッションを
誤誘導する/事故を誘発する類のもの。**2号ローンチ以前に対応を済ませる**、
というのがHidenoriさんの指示。
- ✅ **古い上流クローン`github/mapterhorn`の整理**(2026-09-11完了、
  Hidenoriさんの承認を得て削除): 123MB、最終コミット2026-06-10の素の
  upstreamクローンが`github/hfu-mapterhorn`(実際の作業用fork)の隣に
  残っており、D156と同種の「隣に紛らわしいものがある」事故の温床だった。
  削除前に未コミット変更・未pushコミット・stashのいずれも無いこと、
  remoteが到達可能で再クローン可能なことを検証済み。上流の内容が必要な
  場合は`hfu-mapterhorn`側の`upstream` remote(`git fetch upstream`)を
  使うこと——そちらが唯一の正しい参照経路になった。
- ✅ **`START_HERE.md`の機材表の更新**(2026-09-11完了): `optgeo/japan-geotiff-dem`
  の所在をslate(`github/japan-geotiff-dem-repo`)に修正。あわせて
  「Everything computational happens on slate **over SSH**」という
  D156の原因になった断定を、「まず`hostname`で確認せよ」という形に
  書き換え、ディスクを`diskN`ではなくマウントポイントで呼ぶよう明記
  (D158でdisk6→disk4に変わった実例つき)。
- ✅ **`check_disk_headroom.py`の閾値見直し**(2026-09-11完了、
  `hfu-mapterhorn` commit `216fb22`): 既定を警告300GB/critical 120GBへ。
  1.5号の実成果物から逆算した根拠(merge 237.4GiB in→out、splice後
  240.4GiB)をコード内コメントに明記。あわせて**圧迫時にscratch木の
  サイズを併記**する機能を追加——D157の真因(1週間前のクラッシュ由来の
  孤立scratch 578GB)は、ボリューム単位の空き容量だけ見ていては実データと
  区別できなかったため。
- ✅ **公開スクリプトをtransfer-then-delete順に変更 — 実は1.6号自身の
  公開(D173, 2026-09-17)で既に実施・検証済み**(2026-09-20の本節再チェック
  で判明。このチェックリスト自体、D178の壁修正公開でも同じ手順が繰り返し
  実証されている): `.new`で`scp`転送→ローカル/リモートMD5一致確認→
  同一ディレクトリ内で旧ファイルを日付付きバックアップ名へ`mv`→`.new`を
  正式名へ`mv`、の2段atomic renameへ移行済み。`martin`はfsウォッチで
  数秒以内に追従、再起動不要。D173(elevation/lineage)・D178(壁修正済み
  elevation)の計3回、実データで検証済み。**2号の公開作業もこの手順を
  そのまま使えばよく、新規実装は不要。**

**2026-09-20 再チェックで新たに判明した項目(2号起動前に確認・対応が必要)**:
- ⬜ **[新規] 壁修正(D174-D178)の2号への再適用を、2号自身の標準launch
  手順に組み込むこと**: `build_wall_fix_archive.py`
  (`hfu-mapterhorn/pipelines/`, commit `d7eedee`)はgeneration非依存
  (`--elevation`/`--overview`を明示指定する設計)なので機構としては
  再利用できるが、現状は「1.6号の後始末」としてのみ記録されており、
  「`merge_japan_bundles.py`の後・`stars`公開の前に必ず挟む標準
  手順」としてはどこにも明文化されていなかった。**2号は新しいsource
  データで`jpnationalsea`のカバレッジを一から作り直すため、対策を
  講じなければ壁は2号でも再発する。**

  **2026-09-20時点で確定できる、実行可能なランブック**(D177で実際に
  検証済みのコマンド列そのもの。プレースホルダは2号の実パスに置換
  するだけでよい、コード変更は不要):
  ```
  # 1. z0-7グローバルオーバービュー自身の欠損を埋める
  #    (D174のfill_eligible()はGLO-30インベントリのみに依存し、
  #    generationの実データを参照しない — オーバービュー自体が
  #    1.6号公開後に変わっていなければ bundle-store/wall-fix-z0-7.pmtiles
  #    をそのまま再利用してよい。2026-09-20時点のベースラインmd5:
  #    e66ed06ad81f15d9309cc98d2c0f0b95 (/Volumes/Migrate-2025-04/
  #    global-overview-backup.pmtiles) — 2号着手時にこれと比較し、
  #    一致すればstep 1を丸ごとスキップして良い。)
  uv run python build_wall_fix_archive.py z0-7 \
    --overview /Volumes/Migrate-2025-04/global-overview-backup.pmtiles \
    --out bundle-store/wall-fix-z0-7.pmtiles

  # 2. 2号自身のmerge済みelevationアーカイブに対してz8-z12 fillを作る
  uv run python build_wall_fix_archive.py z8-z12 \
    --elevation bundle-store/mapterhorn-japan-bridge.pmtiles \
    --overview /Volumes/Migrate-2025-04/global-overview-backup.pmtiles \
    --z0-7-fill bundle-store/wall-fix-z0-7.pmtiles \
    --out bundle-store/wall-fix-z8-z12.pmtiles

  # 3. 実アーカイブを先頭にしてmerge(メタデータは最初の入力から
  #    継承される — D174 Major 4の教訓、順序を逆にしないこと)
  ./pmtiles merge bundle-store/mapterhorn-japan-bridge.pmtiles \
    bundle-store/wall-fix-z0-7.pmtiles \
    bundle-store/wall-fix-z8-z12.pmtiles \
    bundle-store/mapterhorn-japan-bridge.wallfix.pmtiles

  # 4. 検証(公開前に必ず両方ともパスすること)
  ./pmtiles verify bundle-store/mapterhorn-japan-bridge.wallfix.pmtiles
  uv run python check_pmtiles_integrity.py bundle-store/mapterhorn-japan-bridge.wallfix.pmtiles
  # -> CLEAN、addressed_tiles_countが (2号のz8-z16タイル数) + 8,321 + (2号自身のz8-z12 fill数) と一致することを確認

  # 5. 旧ファイルを日付付きで保存してから差し替え(削除しない)
  mv bundle-store/mapterhorn-japan-bridge.pmtiles bundle-store/mapterhorn-japan-bridge.pmtiles.pre-wallfix-<YYYYMMDD>
  mv bundle-store/mapterhorn-japan-bridge.wallfix.pmtiles bundle-store/mapterhorn-japan-bridge.pmtiles
  ```
  z0-7/z8-z12のタイル数は2号の実データ次第で1.6号(8,321/152,267)とは
  変わりうる — 数字そのものではなく、`check_pmtiles_integrity.py`が
  CLEANを返すこと、両者を足した`addressed_tiles_count`が一致すること
  を確認基準とする。D174本文にも「2号で全国規模に信頼して使う前に、
  孤立した小島の実例1件で検証済みであること」という条件が明記されて
  いる(既に1.6号で満たされている)。あわせて、D174が検討し不採用と
  した代替案 Option 1b(`jpnationalsea`の矩形ボックス自体を
  ~18-48N/120-155Eへ拡大し、そもそもの欠損cellを減らす)を2号の
  source-catalog更新と合わせて再検討する価値があるかどうかも、2号
  着手時に判断すること(必須ではない、コスト0の追加緩和策として)。

  **[2026-10-01追記、D186]: 上記ランブックはz8-z12単段のみを前提に
  書かれているが、D182以降はz13-z16の第三モードも標準手順に含める
  必要がある。** 1.7号での実施順序: (1) z0-7接合→`mapterhorn-japan-
  bridge.pmtiles`、(2) z8-z12フィル作成→3方向マージ(本体+z0-7フィル+
  z8-z12フィル)→中間アーカイブ、(3) **z13-z16フィルは(2)の中間
  アーカイブを`--elevation`に渡して作成すること**(`build_wall_fix_
  archive.py`のz13-z16モード自身が「z8-z12フィル済みであること」を
  要求する——z8-z12フィルで新たに「実在」になったz12タイルもz13-z16の
  葉ノード候補に含める必要があるため)、(4) 中間アーカイブ+z13-z16
  フィル→最終マージ。**ディスク見積もりの教訓**: 2段構成では、本体
  アーカイブ1世代分(1.7号実績で約275GB)が最大3世代分(z0-7接合版・
  z8-z12修正版・最終版)同時に存在しうる——前の世代をすぐ消さない設計
  にすると合計800GB超が必要になり、1.7号では実際にこれでディスク
  枯渇(ENOSPC)を起こした(D186)。**次回この手順を使う際は、着手前に
  800GB級の空きを確保するか、各中間成果物を検証後すぐ削除する設計に
  すること。**
- ⬜ **[新規] `LAND_UPSAMPLE_ZOOM_BY_GENERATION`テーブルへの2号
  generation_id登録を、ID発番と「同じコミット」で行うこと**
  (`hfu-mapterhorn/pipelines/utils.py`): D166 finding #3が原因究明した
  のと同じ事故クラス — テーブルへの追加が`aggregation_run.py`の
  着手より後になると、既に処理済みのアイテムが永久にupsampleされない
  まま残る。現状このテーブルには1.6号のIDしか入っておらず、
  コード内コメントも1.6号固有の記述のまま。2号のIDを追加する際、
  同じ規律(mint翌日ではなく同一コミット)を再適用すること。

**インフラ面: 準備完了**
- ✅ disk5(`/Volumes/pmtiles-store`)は1.5号のままアタッチ継続で問題なし
  (2026-09-06時点で384Gi/413Gi空き、1.5号のデータと2号のデータは
  generation_id分離により共存可能)。デタッチ不要。
- ✅ `source-coop`/`aws`資格情報はslate側にセットアップ済み。

**2026-09-20時点のGSI DEM1Aライブ確認**: `https://service.gsi.go.jp/kiban/
app/data_update_info/`を直接確認、依然として2026-07-31が最新(新規更新
なし)。11月末という現在の想定と整合。次に確認するのは10月末〜11月頭
あたりで十分。

