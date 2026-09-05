# DECISIONS1.md

Part of `mapterhorn-japan-bridge`'s Architecture Decision Records,
covering **D100-D199**. See [DECISIONS.md](DECISIONS.md) for the
full index (all parts) and the field descriptions (Status/Context/
Decision/Consequences).

---

## D100: bundle.py・merge_japan_bundles.py・pmtiles cluster(D81実証)・最終pmtiles merge完走、しかし整合性チェックで大規模なdownsampling stale markerを発見

**Status**: Recorded, 2026-09-01 20:50 JST頃。

**内容(順調に進んだ部分)**:
- `bundle.py`完走(約30分、想定4時間より大幅に速い)、23ファイル生成、エラーなし。
- `merge_japan_bundles.py`完走(約15分)、`bundle-store/mapterhorn-japan-bridge.pmtiles`(201.65GB、2,001,757タイル)生成。
- **`pmtiles cluster`が実際に成功、D81を確定的に実証**(`clustered: true`、ディレクトリサイズは元の99.91%——bundle.py自体の書き込み順序が既にほぼ最適だったことも判明)。
- `global-overview-backup.pmtiles`(z0-7、Mapterhorn由来、3.27GB)と`pmtiles merge`で結合、`mapterhorn-japan-bridge-with-overview.pmtiles`(204.9GB、z0-16、2,015,281タイル=z8+の2,001,757+global-overviewの13,524、`clustered: true`維持)を生成。約17分で完走。

**内容(重大な発見)**: `check_pmtiles_integrity.py`を実行したところ、**1,818,530件の孤立タイル**(z9:39、z10:472、z12:5,075、z13:5,392、z14:4,288、**z16:1,803,264**)を検出——D72のCLEAN基準から大幅な悪化。z0-7スプライス前のz8+単体ファイルでも全く同じ結果だったため、今回のマージ処理は原因から除外。

サンプルのz16孤立タイルを1件追跡した結果、対応する`10-917-373-15-downsampling.done`マーカー(2026-08-26 04:51、この一連のインシデントより前の非常に古い日付)は存在するが、それが指すはずの`10-917-373-15.pmtiles`はpmtiles-store上に存在しないことを確認。`check_downsampling_done_integrity.py`(D53/D69で実績のある、`.done`マーカーのみを削除する安全なツール)で監査したところ、**`.done`マーカー8,215件中7,079件(86%)がstale**(参照先ファイルが存在しない)と判明。newest stale markerのmtimeは2026-08-31 03:57:48——`aggregation_repair_3344`開始(05:29)の直前であり、D74-D76のカスケード中に、downsampling層の`.done`ブックキーピングがD53/D69と同じメカニズム(aggregation_run.pyの出力ファイル名変更でdownsampling `.done`が指すファイルが消える)で大規模に無効化されたと考えられる。D75で修復した4,396件は氷山の一角で、その後さらに広範囲が影響を受けていた可能性が高い。

**対応**: ツール自身のdocstringが明記する安全条件(「aggregation_run.py完了後にのみ--fix」)を満たしていたため、`--fix`を実行し7,079件のstaleマーカーを削除(コミット時点で実データは一切削除していない、マーカーのみ)。`downsampling_repair2`スクリーンで`downsampling_run.py`を再実行、8,223件全件を対象に再構築中。

**starsへの公開は完全に保留**——この問題が解消し、`check_pmtiles_integrity.py`が改めてCLEANに近い結果を返すまで、rsyncは実行しない。

### Resume prompt

> D100で最終merge(z0-16、204.9GB)まで完走したが、`check_pmtiles_integrity.py`で1,818,530件の孤立タイル(z16だけで1,803,264件)を検出。原因はdownsampling `.done`マーカーの大規模staleness(8,215件中7,079件、86%)——D53/D69と同じクラスのバグがaggregation_repair_3344のファイル名変更で大規模に再発したもの。`check_downsampling_done_integrity.py --fix`で7,079件のstaleマーカーを削除済み、`downsampling_repair2`スクリーンで8,223件全件を再構築中。完了後: (1) `check_downsampling_readiness.py`で0 not-readyを確認、(2) `bundle.py`+`merge_japan_bundles.py`+`pmtiles cluster`+`pmtiles merge`を**やり直す**(今の`mapterhorn-japan-bridge-with-overview.pmtiles`は孤立タイルを含む不完全な成果物なので、そのまま使わないこと)、(3) `check_pmtiles_integrity.py`で改めて確認(0件目標)、(4) D79の視覚確認、(5) starsへrsync(Hidenoriに一声かけてから)。starsへの公開は絶対にこの修正完了前に行わないこと。

## D101: `downsampling_run.py`の再構築が想定より大幅に遅い(約2件/分)、`PRIORITY_MODE`環境変数が実は無視されるデッドコードだったと判明

**Status**: Recorded, 2026-09-01 21:05 JST頃。D100の7,079件再構築中に発見。

**内容**: `downsampling_repair2`スクリーンの進捗を`check_downsampling_readiness.py`で追跡したところ、約14分間で.doneが18〜26件しか増えていない(約1.3〜1.9件/分)。7,079件全体をこのペースで処理すると**約60時間規模**にかかる計算——publish_cycle.pyが`DOWNSAMPLING_WORKERS=3`・`PRIORITY_MODE=quadrans`という標準設定で起動したにもかかわらず。

コードを読んだところ、`downsampling_run.py`の`__main__`ブロック(500行目付近)が`sort_files_by_proximity(all_files, CENTER_LAT, CENTER_LON)`を**無条件に**呼んでおり、`PRIORITY_MODE`環境変数を一切参照していない——モジュール冒頭で`PRIORITY_MODE = os.environ.get('PRIORITY_MODE', 'proximity')`という変数は定義されているが、**どこからも使われていないデッドコード**だった。実際のログにも`=== Processing Order (Center: 8.465, -13.234) ===`とFreetown(デフォルトのCENTER_LAT/LON)が表示されており、`quadrans`指定は完全に無視されていることを確認。

処理構造自体も判明: 外側の`for`ループが8,223件の"item"を**逐次**処理し、各itemの内部でだけ`pool.starmap(create_tile, ...)`が3ワーカーで並列化される(itemをまたいだ並列化はない)。つまりitemの処理順序が悪いと、たまたま重いitemが連続して並び、ワーカーの稼働率が悪化しうる——D21がaggregation_run.pyで見つけたのと同じ「地理的にソートされた順序が高コストなタイルを固めてしまう」パターンがdownsampling側にも存在する可能性がある。

**未対応の理由**: 原因(itemの処理順序 vs. 単純にitem自体が重い vs. その他)を確定できていない。修正版(シャッフル導入)を試すには実行中のプロセスを止めて再起動する必要があり、これまでの進捗(1,000件強)を無駄にする判断になる。現時点では実害(遅いだけで不正確ではない、`DOWNSAMPLING_STRICT=1`により安全)は無いため、**しばらく様子を見て実測ペースの推移を確認してから判断する**方針とした。

### Resume prompt

> D101で`downsampling_run.py`の`PRIORITY_MODE`環境変数がデッドコード(常にFreetown中心のproximityソートが使われる)と判明。7,079件の再構築が約60時間規模ペースで進行中——遅い原因はitem処理順序の可能性(D21と同種のパターン)だが未確定。しばらく実測ペースを追跡し、改善しなければD21と同じシャッフル対策の導入(グレースフル停止→コード修正→再起動、これまでの進捗は`.done`マーカーにより失われない)を検討すること。`PRIORITY_MODE`のデッドコード自体は号2に向けて修正または削除を検討する価値がある(現状は嘘の設定に見えて実は何もしていない)。

## D102: D101の訂正 — `PRIORITY_MODE`はデッドコードではなかった。実際の遅さの原因はI/Oバウンドな処理そのもの

**Status**: Recorded, 2026-09-01 21:20 JST頃。CLAUDE.md/HANDOVER.mdの更新作業の一環で`downsampling_run.py`を再確認して発覚。

**内容**: D101は`sort_files_by_proximity(all_files, CENTER_LAT, CENTER_LON)`の**呼び出し側**（`__main__`ブロック、520行目付近）だけを見て、「引数に`PRIORITY_MODE`が渡っていない＝無視されている」と誤って結論していた。実際には`sort_files_by_proximity()`内部の`sort_key()`クロージャが、モジュールスコープの`PRIORITY_MODE`変数（`os.environ.get('PRIORITY_MODE', 'proximity')`で設定済み）を直接参照しており、`if PRIORITY_MODE == 'quadrans':`の分岐で`utils.japan_quadrans_of()`ベースの優先度に正しく切り替わる。`downsampling_repair2`は`PRIORITY_MODE=quadrans`で起動されているため、実際の処理順序はquadrans優先度で決まっている——D101が疑った「常にFreetown距離でソートされている」は誤りだった。

ログの`=== Processing Order (Center: 8.465, -13.234) ===`という表示は、単に印字コード自体が`CENTER_LAT`/`CENTER_LON`のデフォルト値を無条件に表示しているだけ（実際のソートキーで使われているかどうかとは無関係）で、これがD101の誤読を招いた直接の原因だった。この印字文自体は実害はない（誤解を招くだけ）ため、修正の優先度は低い。

**訂正した理解**: 約2件/分という遅さの原因は、ソート順序のバグではなく、D44/D56が既に指摘していた「粗いズームのitemほど大きなpmtiles-storeアーカイブの読み込みI/Oが重い」という、元から分かっていた特性がそのまま表れている可能性が高い。`slate`は10コア/16GB、両ボリューム(`Migrate-2025-04`/`pmtiles-store`)ともUSB接続のSSD（`diskutil info`で確認、Solid State: Yes）。プロセス自体のCPU使用率は実測0.1%程度と低く、CPUバウンドではなくI/Oバウンドであることと整合する。`DOWNSAMPLING_WORKERS=3`は10コアに対して控えめな設定であり、SSD（spinning diskと異なりランダムI/Oの並列化に強い）という条件を踏まえると、ワーカー数を増やす余地がある可能性がある。

**対応**: D21のシャッフル対策（ソート順序の問題という誤った前提に基づく提案）は見送り。代わりに、`DOWNSAMPLING_WORKERS`を増やす実験を次に検討する——ただし本番プロセスの再起動を伴うため、実測データ（現在の~2.1件/分という基準値）を確保した上で、小さく試す。

### Resume prompt

> D101の「PRIORITY_MODEはデッドコード」という診断は誤りだったとD102で訂正済み——実際にはquadrans優先度が正しく機能している。約2件/分という遅さはI/Oバウンドな処理特性(D44/D56)によるものと理解し直した。次の一手はワーカー数(`DOWNSAMPLING_WORKERS=3`→増加)の実測チューニング検討。ソート順序側の追加調査は不要。

## D103: downsampling再収束完了(8,219/8,223)、`bundle.py`再実行が`ENOSPC`でクラッシュ→原因はD100の古いstale成果物が未削除のまま残っていたこと

**Status**: Recorded, 2026-09-02 03:59 JST頃。

**内容**: `downsampling_repair2`が03:31に完走。`check_downsampling_readiness.py`で確認したところ、8,219/8,223 done、ready-not-run 0、not-ready(子タイル欠落)4件——D98時点の8件から改善(aggregation修復の効果で一部が真に準備完了した可能性)。残り4件は構造的な欠落(`6-54-25-{8,9,10,11}`)で、D52/D77と同種の許容できるギャップと判断し、そのまま先に進めた。

`bundle.py 1`を`bundle_rebuild2`スクリーンで起動したところ、数分で`OSError: [Errno 28] No space left on device`でクラッシュ。調査したところ、`bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`(D100で生成された、孤立タイルを含む既知のstale成果物、204.9GB)が削除されずそのまま残っており、これが新規bundle出力と共存しようとして空き容量を圧迫していたことが直接の原因と判明(`disk_headroom.log`では03:47:39時点で833GB freeと出ていたため、瞬間的な競合か、実際にはより早い時点で枯渇していた可能性がある——正確な瞬間は特定できていない)。

**対応**: `bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`(D100が明示的に「そのまま使わないこと」と警告していた成果物)と、クラッシュ時の空の部分ファイル(z6タイル群・`planet.pmtiles`・`mapterhorn-japan-bridge.pmtiles`)を削除。空き容量は776Gi→967Giに回復。`bundle_rebuild3`スクリーンで`bundle.py 1`を再起動。

**教訓**: 今後、downsampling再収束後にbundle.pyを再実行する前には、**前回サイクルの`bundle-store`配下の古い成果物を先に削除してから実行する**ことをチェックリスト化すべき(D95の「号2向け準備」に追記候補)。

### Resume prompt

> D103でbundle.py再実行が古いstale成果物によるディスク枯渇でクラッシュ→原因ファイルを削除して`bundle_rebuild3`で再起動済み。完了後は D99/D100と同じ流れ: `merge_japan_bundles.py`(`TMPDIR=/Volumes/pmtiles-store/tmp-store/writer-scratch/`)→`pmtiles cluster`→`pmtiles merge`(`global-overview-backup.pmtiles`と)→`check_pmtiles_integrity.py`→D79視覚確認→Hidenoriに一声かけてからstarsへrsync。pmtiles-store側にも同様の古い中間成果物(cluster後ファイル等)が残っていないか、mergeステージに進む前に確認すること。

## D104: `bundle.py`の`ENOSPC`クラッシュの真因判明 — pmtilesライブラリの`Writer`が内部スクラッチファイルを`tempfile.TemporaryFile()`(=`TMPDIR`、起動ディスク側)に作成していた

**Status**: Recorded, 2026-09-02 04:18 JST頃。D103の対処後、`bundle_rebuild3`で全く同じ`ENOSPC`が再発したことを受けて調査。

**内容**: D103で`bundle-store`上の古いstale成果物を削除し空き容量を967Giまで回復させたにもかかわらず、`bundle_rebuild3`(`bundle.py 1`)が同一エラーで再クラッシュ。クラッシュ直後の`bundle-store`実際の使用量はわずか5.4GB(`planet.pmtiles`が5.78GB、他は0バイトの空ファイル)——`Migrate-2025-04`側の空き容量(962Gi)には遠く及ばず、ボリューム容量不足という診断が誤りだったことが判明。

`.venv`内の`pmtiles`ライブラリ(`pmtiles/writer.py`)の`Writer.__init__`を確認したところ、`self.tile_f = tempfile.TemporaryFile()`という行があり、**実際のタイルバイトデータは`out_filepath`(`bundle-store/{name}.pmtiles`、`Migrate-2025-04`上)ではなく、Pythonのデフォルト一時ディレクトリ(`TMPDIR`環境変数、未設定時は`/var/folders/.../T/`、起動ディスク側)に一旦バッファされる**ことが判明。`df /`で確認したところ起動ディスクは99GB程度しか空きがなく(APFSコンテナ`disk3`のCapacity Not Allocated: 105.9GB)、`BUNDLE_WORKERS`のデフォルト4ワーカーが同時に大きなアーカイブを構築すると、各ワーカーの一時ファイルの合計が起動ディスクの空き容量を容易に超えてしまう——これが実際の`ENOSPC`の発生源だった。

`/Volumes/pmtiles-store/tmp-store/writer-scratch/`ディレクトリに、D100当時の`merge_japan_bundles.py`実行が残した201.6GBの孤立一時ファイル(`pmtiles1351744159`、Sep 1 19:43付け)が見つかったことも、この仮説を裏付ける傍証——**D99で`merge_japan_bundles.py`に`TMPDIR=/Volumes/pmtiles-store/tmp-store/writer-scratch/`を指定していたのは、まさにこの同じ問題への対処だった**が、その教訓が`bundle.py`には適用されていなかった。

**対応**: 孤立一時ファイルを削除。`bundle-store`をクリアし、`bundle.py 1`に`TMPDIR=/Volumes/pmtiles-store/tmp-store/writer-scratch/`を指定して`bundle_rebuild4`スクリーンで再起動。

**教訓**: `pmtiles`ライブラリの`Writer`を使うスクリプト(`bundle.py`・`merge_japan_bundles.py`のいずれも該当)は、**`TMPDIR`を明示的に`pmtiles-store`側に向けない限り、常にこの潜在的なリスクを抱える**。D95の号2向け準備チェックリストに「`bundle.py`にも`TMPDIR`指定を追加する」ことを恒久修正として追記する価値がある(現状は都度スクリーン起動時に手動で環境変数を渡す運用で回避)。

### Resume prompt

> D104でbundle.pyのENOSPCクラッシュの真因が判明: pmtilesライブラリのWriterが内部一時ファイルをTMPDIR(起動ディスク側、空き~100GB)に作成するため、ワーカー並列実行で容易に枯渇する。TMPDIR=/Volumes/pmtiles-store/tmp-store/writer-scratch/を指定して`bundle_rebuild4`で再起動済み。今後: bundle.py完走後は D99/D100と同じ流れ(merge_japan_bundles.py→pmtiles cluster→pmtiles merge→check_pmtiles_integrity.py→D79視覚確認→Hidenoriに一声かけてrsync)。恒久対処として、bundle.py自体にTMPDIR設定をハードコードするか、起動時ラッパースクリプトに含めることを検討(号2向けPLAN.mdにも追記候補)。

**追記(04:57 JST)**: Hidenoriさんの「TMPDIR問題には何度も悩まされている、slate固有かもしれないがパターンかもしれない」という指摘を受け、恒久対処を実施。`bundle.py`・`merge_japan_bundles.py`双方の冒頭に`os.environ.setdefault('TMPDIR', ...)`を追加し、以後は毎回手動で環境変数を渡さなくても自動的に`pmtiles-store/tmp-store/writer-scratch/`が使われるようにした(`hfu/mapterhorn`フォーク側、コミット済み・push済み)。この問題の本質は**slate固有ではなく、pmtilesライブラリの`Writer`クラスが`tempfile.TemporaryFile()`をパス指定なしで使う汎用的な性質**であり、実データを起動ディスクより大きい外部ボリュームに置く構成であればどの環境でも再現しうる。号2・1.5号を含め今後は自動的に回避される。

**追記(05:02 JST)**: `bundle_rebuild4`が43分で正常完走(エラーなし、23ファイル、`bundle-store`合計289GB)。恒久TMPDIR修正が効き、クラッシュなく完走したことを確認。`merge_japan_bundles.py`を`merge_bundles2`スクリーンで起動(恒久修正によりTMPDIR手動指定は不要)。

## D105: D104のTMPDIR恒久修正が実は無効だった — `os.environ.setdefault()`はmacOSが既に設定済みの`TMPDIR`を上書きしない

**Status**: Recorded, 2026-09-02 05:16 JST頃。

**内容**: D104で`bundle.py`・`merge_japan_bundles.py`双方に`os.environ.setdefault('TMPDIR', 'pmtiles-store/tmp-store/writer-scratch/')`を追加したが、`merge_bundles2`スクリーン(シェル側で明示的な`TMPDIR`指定なし、コード側の恒久修正のみに依存)を実行したところ、800,000タイル処理時点で全く同じ`ENOSPC`が再発。

原因: macOSのSSH/ログインシェルセッションでは、**`TMPDIR`環境変数がセッション開始時点で既に`/var/folders/.../T/`に設定されている**(launchdによる自動設定)。`os.environ.setdefault()`はキーが「存在しない」場合のみ値を設定する仕様のため、既に値が入っている`TMPDIR`に対しては何もしない——D104の恒久修正は最初から一度も効いていなかった。ちなみに`bundle_rebuild4`(D104本文で完走を報告した実行)が成功したのは、コード側の修正ではなく、**そのスクリーン起動コマンド自体にシェルレベルで明示的に`export TMPDIR=...`を含めていたから**(この修正コードを書く前に起動していたため)。

**対応**: `os.environ.setdefault(...)`を`os.environ['TMPDIR'] = ...`(無条件上書き)に変更し、念のため`tempfile.tempdir = None`でモジュール側のキャッシュもクリア。合わせて`merge_bundles3`スクリーンでは、コード修正に加えシェル側でも明示的に`TMPDIR`をexportして二重に担保して再起動。

**教訓**: `os.environ.setdefault()`は「呼び出し元が明示的に設定した値を尊重する」という意図で使ったが、**「システムが常に何かしらの値を事前設定している」変数(`TMPDIR`はその典型)には`setdefault`は事実上無力**——「未設定」を「呼び出し元の意図的な指定」と取り違えてはいけない、という一般的な教訓。今後同様の環境変数デフォルト設定を書く際は、対象の変数がOS/シェルによって常に事前設定されるものかどうかを先に確認すること。

### Resume prompt

> D105でD104の「恒久修正」が実は無効だった(os.environ.setdefault()がmacOSの事前設定済みTMPDIRを上書きしない)ことが判明、無条件上書きに修正・push済み。merge_bundles3で再起動(コード修正+シェル側exportの二重担保)。完了後はD99/D100と同じ流れ: pmtiles cluster→pmtiles merge(global-overview-backup.pmtilesと)→check_pmtiles_integrity.py→D79視覚確認→Hidenoriに一声かけてrsync。以降bundle.py/merge_japan_bundles.pyを直接起動する際も、コード側の修正を過信せずシェル側のTMPDIR明示指定を当面は併用すること。

**追記(05:43 JST)**: `merge_bundles3`が正常完走(エラーなし、`bundle-store/mapterhorn-japan-bridge.pmtiles`、217.4GB、1,777,785タイル)。D81に従い`pmtiles cluster bundle-store/mapterhorn-japan-bridge.pmtiles`を`pmtiles_cluster2`スクリーンで起動。

**追記(06:13 JST)**: `pmtiles cluster`が正常完走(11分、エラーなし、`total directory size 3817864 (99.761849% of original)`——D100実績とほぼ同水準)。`global-overview-backup.pmtiles`(3.27GB)を`/Volumes/Migrate-2025-04/global-overview-backup.pmtiles`で確認し、`pmtiles merge bundle-store/mapterhorn-japan-bridge.pmtiles /Volumes/Migrate-2025-04/global-overview-backup.pmtiles bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`を`pmtiles_merge2`スクリーンで起動。

**追記(06:43 JST)**: `pmtiles merge`が正常完走(26分、`bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`、220.65GB)。真の検証として`check_pmtiles_integrity.py`を`integrity_check2`スクリーンで起動(D100でオーファンタイルを発見したのと同じ検証ステップ)。

**追記(06:45 JST)**: `integrity_check2`完走(8秒)。**孤立タイル2,048件、全てz12**——D100の1,818,530件から劇的に改善。サンプル座標(3513,1615)(3515,1661)(3500,1621)(3512,1631)(3507,1637)は全て`z6=(54,25)`タイルの子孫範囲([3456,3520)×[1600,1664))に収まっており、これは`check_downsampling_readiness.py`で判明していた「構造的に子タイル欠落」4項目(`6-54-25-{8,9,10,11}`)と同一地域。この`z6=(54,25)`タイルの地理座標は東経123.75-129.38度・北緯31.95-36.60度で、**東シナ海(九州西方の外洋)**——D77で既に確認済みの「外洋の構造的欠落」パターンと一致する海域。

新しいバグではなく、実際にネイティブaggregationカバレッジが存在しない(=元データが無い)実在の欠落と判断。D72のCLEAN基準(孤立タイル0件)には届いていないが、原因が特定・説明可能であり、D77と同種の「Mapterhorn自身のデータ限界」に由来するものと判断し、次のD79視覚確認に進む。

**追記(07:05 JST)、D79検証結果**: パイプライン再構築完了後、`bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`から倉橋島・呉市周辺(D74で報告された`10-889-408`タイル、東経132.54-132.89度・北緯34.02-34.31度)のz12タイルを17×17枚(289枚)モザイクとして抽出し、Terrarium形式から標高値を復元してヒルシェード画像化した(`d79_visual_check.py`、コミットはしていない一時検証スクリプト)。

全体像・本土山岳部の詳細クロップ2枚・海岸線/島嶼部の詳細クロップ2枚、計5枚を目視確認した結果、**512pxブロック格子に沿った不連続(市松模様)は見当たらなかった**。海岸線・島の陰影は滑らかで連続しており、D79が仮説として挙げたブロック境界での「生データ」と「ブレンド済みデータ」の接合線は確認できなかった。

**留保事項**: (1) このエリアはz13以上のカバレッジが無く(水域寄りのため)、確認できたのはz12までであり、元々報告があった正確なズームレベルとは異なる可能性がある。(2) 目視確認は私(エージェント)による静的な陰影起伏図でのスクリーニングであり、Hidenoriさん自身による実機・実ビューアでの最終確認とは異なる。(3) D74-D76の一連の破損・復旧作業自体が、D79が疑ったブロック境界問題とは無関係に、何らかの形で症状を解消した可能性もあり、根本原因(D79の仮説が正しかったかどうか)は依然未確定のまま。

**結論**: 現時点で確認できる範囲では、報告されていた市松模様アーティファクトは再現しなかった。starsへの公開後、Hidenoriさん自身による実ビューアでの最終確認を推奨する。

## D106: 1号のstars公開を開始 -- Hidenoriさんの承認を得てrsync実行中(旧ファイル311.4GB削除→新ファイル220.65GB転送、想定約5.5時間)

**Status**: Recorded, 2026-09-02 07:20 JST頃。

**内容**: D105までの全工程(downsampling→bundle→merge→cluster→merge→整合性チェック→D79視覚確認)完了後、Hidenoriさんに公開の意思確認を行い、明示的な承認(「starsへrsyncして1号を公開する」)を得た。

`publish_cycle.py`の既存rsync行(`bundle-store/mapterhorn-japan-bridge.pmtiles`、overview結合前)をそのまま使うのではなく、D96以降の運用に合わせて**overview結合済みファイル**(`bundle-store/mapterhorn-japan-bridge-with-overview.pmtiles`)を、公開ビューアが参照するURL(`style.json`の`https://stars.optgeo.org/mapterhorn-japan-bridge`)に合わせて`mapterhorn-japan-bridge.pmtiles`という名前で`stars`側にrsyncするよう変更した(転送時にリネーム)。

**旧ファイルとの比較**: `stars`側の旧ファイル(311.4GB、8/30 12:22付け、2,568,241タイル)は、新ファイル(220.65GB、1,777,785タイル)より明らかに大きい。D74の発見(8/30 22:50、旧ファイル生成後)——「pmtiles-store全体の50%の位置に、削除されずに残った新旧混在の重複pmtilesファイルが存在し、bundle.pyがそれを全て拾い集めていた」——を踏まえると、旧ファイルはこの重複データによって水増しされていた可能性が高いと判断(D72のCLEAN判定は孤立タイルの有無のみを見ており、同一位置の重複ファイル問題とは別軸だったため、この水増しをすり抜けていたと考えられる)。新ファイルの方が正確である可能性が高い。

**手順**: `stars`側の空き容量(152GB)が新ファイルサイズ(220.65GB)に対して不足していたため、D50/D51の教訓(2倍ヘッドルームを避けるため旧ファイルを先に削除)に従い、まず`ssh stars@stars.local rm -f /home/stars/data/mapterhorn-japan-bridge.pmtiles`を実行(auto modeの分類器が自動ブロック→Hidenoriさんに明示確認の上で承認を得て実行)。その後`rsync -av --partial --progress`で新ファイルを転送開始(`publish_rsync`スクリーン、11MB/s、想定完了まで約5.5時間)。転送中は`stars.optgeo.org/mapterhorn-japan-bridge`が404になる(意図した一時的な公開URL停止)。

stars側を管理する別セッション(`stars-fd`)に事前通知済み。

### Resume prompt

> D106でHidenoriさんの承認を得てstarsへのrsyncを開始(旧ファイル削除→新ファイル転送、`publish_rsync`スクリーン、想定完了07:20+5.5h≈12:50 JST頃)。完了後: 転送先での`check_pmtiles_integrity.py`相当の確認(または単純なファイルサイズ/日付確認)→公開URLが200を返すことを確認→Hidenoriさんに完了報告。転送を待たずに1.5号の準備(D95/D96/D93/D94の実装、Hidenoriさんの追加指示によるファイル名リファクタリング含む)を並行して進めること。

## D107: 1.5号向けにpmtiles-storeレイヤー名前空間分離を実装(D95案A) -- aggregation/downsampling層、elevation/lineageデータ種別の両軸で分離

**Status**: Recorded, 2026-09-02 07:40 JST頃。Hidenoriさんの指示(starsへのrsync継続中に1.5号準備着手、命名リファクタリングを1.5号で積極的に行う)を受けて実装。EnterPlanModeで計画を提示・承認を得てから実装。

**内容**: `utils.get_pmtiles_folder(x, y, z)` を `get_pmtiles_folder(x, y, z, layer, datatype='elevation')` に変更。返り値は `pmtiles-store/{layer}/{datatype}/...`(layer∈{aggregation, downsampling}、datatype∈{elevation, lineage})。D74-D76の根本原因(両層が同じファイル命名規則を共有し名前だけでは区別不能)を、ディレクトリ構造そのものに識別子を組み込むことで解消(D95案A)。

新規`utils.resolve_layer(aggregation_id, z, x, y, child_z)`も追加。downsampling_run.pyが子タイルを参照する際、その子が「ネイティブaggregation leaf」か「downsamplingピラミッドの中間成果物」かは、ファイル名だけでは判定不能(downsampling_covering.pyのカバレッジ生成が本質的に再帰的なため、同じz-x-y-child_zの組がどちらの層にもなりうる)——`{z}-{x}-{y}-{child_z}-aggregation.csv`が存在するかどうかで判定する関数として実装。

**更新した呼び出し箇所**(`grep -rn get_pmtiles_folder`で11箇所確認、うち本番パイプラインの8箇所を更新): `aggregation_tile.py`(自身の書き込み、layer='aggregation'固定)、`downsampling_run.py`(3箇所——1箇所は自身の出力でlayer='downsampling'固定、残り2箇所は子タイル参照でresolve_layer()による動的判定)、`check_downsampling_done_integrity.py`(downsampling自身の出力監査、layer='downsampling'固定)、`check_downsampling_readiness.py`(子タイル参照、resolve_layer()で動的判定)、`mjbmon_snapshot.py`(aggregation層の監視、layer='aggregation'固定)。`bundle.py`は`get_pmtiles_folder()`を使わず独自globだったため、`pmtiles-store/{aggregation,downsampling}/{datatype}/**`を横断的にglobするよう変更。

**対象外とした2ファイル**: `check_aggregation_dirty_gap.py`・`check_covering_gaps.py`は1号の特定generation_id(`01M0MWK852631SHCHPA66F21WQ`等)をハードコードしたD52/D56当時の一回限りの調査スクリプトであり、標準運用の一部ではないため更新しなかった。

**重要な副作用(意図的)**: この変更後、これらのスクリプトは1号の既存データ(フラット構造、`pmtiles-store/{z7親}/...`)を発見できなくなる。1号は全工程完了・stars公開rsync進行中(D106)であり、以後これらのスクリプトを1号のgeneration_idに対して再実行する必要はない想定。1.5号は新しいgeneration_idで最初からレイヤー分離済み構造に書き込むため、1号のデータへの移行・変更は一切行っていない。

**動作確認**: `get_pmtiles_folder()`への新シグネチャでの呼び出し・`layer`未指定時のTypeError発生を実機で確認。全7ファイルの構文チェック(`py_compile`)通過。

### Resume prompt

> D107でpmtiles-storeレイヤー分離を実装・push済み(`hfu/mapterhorn` `8545a12`)。1号のstars公開rsync(D106)には影響なし(pmtiles-store構造とは無関係)。次はlineageタイル機能(D93/D94)の実装——`lineage_inspect.py`のcompute_provenance()を共有関数化し`aggregation_run.py`にEMIT_LINEAGEフラグで組み込む、downsampling_run.pyのcreate_tile()にdatatype分岐を追加してlineage_downsample.pyの多数決ロジックを接続、新規lineage_tile.pyでカテゴリ値のPMTiles書き出しを実装。その後、命名リファクタリング(mapterhorn-japan-bridge.z8plus.pmtiles等)とpipelines-rehearsal/での小規模リハーサルテストを経てから、Hidenoriさんに1.5号の全国スケールlaunch可否を確認すること。

## D108: lineageタイル機能を実装・実機統合テストで検証(D93/D94/D96) -- aggregation側emission、downsampling側多数決、いずれも実データ経路で動作確認

**Status**: Recorded, 2026-09-02 08:10 JST頃。1号のstars公開rsync(D106)と並行して実装。

**内容**: D93が見積もり・D94がアルゴリズムを先行実装していたlineageタイル機能を、D107のレイヤー分離基盤の上に実装。

**新規ファイル**:
- `lineage_provenance.py`: `lineage_inspect.py`から`compute_provenance()`・`GLOBAL_TIER`・`global_tier_of()`を共有関数として抽出。新規`local_provenance_to_global()`で、タイル固有のLOCAL group-indexをGLOBAL_TIER(0-6、nodata=255)に変換(タイル間で値の意味を揃えるため必須、`lineage_inspect.py`自身が既に指摘していた罠)。
- `lineage_tile.py`: `aggregation_tile.py`のcreate_tiles/create_tileと並行する構造で、in-memoryのカテゴリ配列を512pxブロックに切り出し、`utils.save_lineage_tile()`でWEBP化・`create_archive()`でPMTiles化。ブロックファイルは`{tmp_folder}/lineage-blocks/`という専用サブフォルダに書き出す設計——`aggregation_tile.py`が後で同じtmp_folderに`.webp`を書くため、`create_archive()`の無条件`*.webp`globが両datatypeを混同しないようにするため(実装中に発見した衝突リスク)。
- `utils.save_lineage_tile()`: R=カテゴリ値、A=有効性のロスレスWEBPエンコード。往復テストで完全一致を確認済み。

**変更ファイル**:
- `aggregation_run.py`: `EMIT_LINEAGE`環境変数フラグ追加。**重要な設計訂正**: 当初D93は「`aggregation_merge.merge()`の直後に挿入」を推奨していたが、実装中に`aggregation_merge.merge()`が個別のreprojectedタイフ(`{i}-3857.tiff`)を自身の完了時に削除する(単一ソースの場合はリネームして消える)ことが判明——`compute_provenance()`はこれらのタイフを必要とするため、**`aggregation_reproject.reproject()`の直後・`merge()`の前**に挿入するよう訂正した(`lineage_inspect.py`自身がmerge()を呼ばずreproject()のみ使う設計だったことと整合)。
- `downsampling_run.py`: `DOWNSAMPLING_DATATYPE`環境変数フラグ追加(`elevation`/`lineage`)。`create_tile()`に多数決分岐を追加、`lineage_downsample.majority_vote_downsample()`(D94実装済み)を接続。3箇所の`get_pmtiles_folder()`呼び出しに`datatype=DOWNSAMPLING_DATATYPE`を追加。

**実機統合テスト**: 4枚の合成leaf lineageタイル(カテゴリ2×3・カテゴリ5×1)を実際に`lineage_tile.main()`で生成し、実際の`downsampling_run.create_tile()`(`DOWNSAMPLING_DATATYPE=lineage`)を呼び出して多数決の結果を検証——各象限が期待通りのカテゴリ値になることを確認、PASS。`resolve_layer()`・`get_pmtiles_folder()`・PMTiles読み書きを含む実データ経路での検証(モックなし)。

**未実装**: `bundle.py`/`merge_japan_bundles.py`のlineage用アーカイブ構築(現状はelevation datatypeのみ対応)、ファイル名リファクタリング(with/without-overview命名解消)、`pipelines-rehearsal/`での全国規模想定の小規模リハーサル。

### Resume prompt

> D108でlineageタイル機能を実装・実機統合テストで検証済み(`hfu/mapterhorn` `2cdd5ed`・`291e0c3`)。次: bundle.py/merge_japan_bundles.pyをdatatype対応させ、terrarium/lineage別々のアーカイブを構築できるようにする。その後、命名リファクタリング(`mapterhorn-japan-bridge.z8plus.pmtiles`等)→pipelines-rehearsal/での小規模全工程リハーサル→複数回レビュー→Hidenoriさんに1.5号全国launch可否を確認、という順で進める。1号のstars公開rsync(D106)には無関係、並行して進行中。

## D109: bundle.py/merge_japan_bundles.pyをdatatype対応、ファイル名リファクタリングでwith/without-overviewの曖昧さを解消(1.5号向け)

**Status**: Recorded, 2026-09-02 08:25 JST頃。D107/D108の続き、Hidenoriさんの明示的な指示(「ファイル名は混乱のないようにリファクタリングする、2号を高速化するため1.5号で済ませる」)への対応。

**内容**:
- `bundle.py`: `BUNDLE_DATATYPE`環境変数(`elevation`/`lineage`)を追加。`get_parent_to_filepaths()`は既にD107でdatatype対応済み。`get_name_from_parent()`がlineage時に出力ファイル名へ`-lineage`サフィックスを付与し、bundle-store上でelevation/lineageの成果物が衝突しないようにした。
- `merge_japan_bundles.py`: `MERGE_DATATYPE`環境変数を追加。**命名リファクタリング**: 従来`bundle-store/mapterhorn-japan-bridge.pmtiles`という同一名を、overview結合前(このスクリプトの出力)・結合後(公開用最終成果物)の両方が名乗りうる状態だった——これがD103のENOSPC事故(古い方を消し忘れて容量不足)の遠因。今後は結合前の中間ファイルを`mapterhorn-japan-bridge.z8plus.pmtiles`(D46以前の`japan-z8plus.pmtiles`命名を踏襲)、lineage(overview結合が不要——Mapterhorn本家のグローバル製品にはlineageデータが存在しないため)は`mapterhorn-japan-bridge-lineage.pmtiles`をそのまま最終名とする。**`mapterhorn-japan-bridge.pmtiles`という名前は、以後「overview結合済みの公開可能な最終成果物」だけを指す**——曖昧な"どちらか"が存在しなくなった。`INPUTS`のglobもdatatypeでフィルタし、elevation/lineageのbundle-store成果物を取り違えないようにした。

**動作確認**: 合成ファイル名でのフィルタリングロジックのテスト、実際のモジュールimport・`get_name_from_parent()`/`OUTPUT`定数の値を実機確認。

**既知の未対応ギャップ(意図的に今回は触れず)**: `publish_cycle.py`(自動化用の日次サイクルスクリプト、D50/D51時代のもの)は今も`bundle-store/mapterhorn-japan-bridge.pmtiles`を直接rsync元にしており、overview結合ステップ自体を含んでいない——D77(z0-7グローバル接合)以前の設計のまま。今夜のD97-D106の1号再構築は全て手動実行(publish_cycle.pyは未使用)だったため実害はなかったが、このスクリプト自体を将来自動化に使うなら、rsync元ファイル名の更新だけでなく、overview結合ステップの追加も必要——名前だけ変えて中身が伴わない見せかけの修正を避けるため、今回は意図的に手を付けていない。1.5号でも引き続き手動実行を前提とする。

### Resume prompt

> D109でbundle.py/merge_japan_bundles.pyのdatatype対応・命名リファクタリング完了(`hfu/mapterhorn` `750b237`)。以降の手動実行コマンド: `pmtiles merge bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles /Volumes/Migrate-2025-04/global-overview-backup.pmtiles bundle-store/mapterhorn-japan-bridge.pmtiles`(elevation最終成果物)。lineageは`bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`がそのまま最終成果物(overview結合不要)。`publish_cycle.py`はoverview結合ステップが無いまま未修正——将来自動化に使う前に要対応、今回はスコープ外として明記のみ。次: 命名リファクタリングの残り(generation_id↔人間可読ラベルの対応表をPLAN.mdに追加)→pipelines-rehearsal/での小規模リハーサル→複数回レビュー→Hidenoriさんに1.5号launch可否を確認。

## D110: 1.5号向けlineage実装の実データリハーサル成功 -- aggregation_run.py(EMIT_LINEAGE)を実GeoTIFFデータで実行、期待通りの結果

**Status**: Recorded, 2026-09-02 08:35 JST頃。D107-D109の実装完了後、Hidenoriさんの指示(launch前の入念なレビュー)に従い、実データでのリハーサルを実施。

**内容**: 1号の実データ(`10-930-369-13-aggregation.csv`、jpnational10×10ファイル+jpnationalsea×2ファイルの混在アイテム)を使い捨てgeneration_id(`00TEST0000000000REHEARSAL01`)にコピーし、`EMIT_LINEAGE=1`で`aggregation_run.run()`を実行。

**結果**: reproject→lineage計算→merge→タイル化の全工程が実データ・実GDAL処理で正常完走。elevation・lineage両方のPMTiles leafアーカイブが正しいレイヤー/データ種別のディレクトリ(`pmtiles-store/aggregation/{elevation,lineage}/...`)に生成された。lineageアーカイブの中身を実際に読み出したところ、**jpnational10(tier 5): 43.8%、jpnationalsea(tier 6): 56.2%**——このアイテムの地理的性質(海岸部)と整合する、現実的な分布。最初の実行でPATH起因のエラー(`gdalbuildvrt: command not found`、非対話SSHセッションで`/opt/homebrew/bin`が通っていなかっただけ)に遭遇したが、コード自体のバグではないことを確認。最終的な`.todo`→`.done`リネームのみ、テスト自体が`.todo`マーカーを用意していなかったため意図的に失敗させた(実害なし)。

リハーサル後、使い捨てgeneration_idのaggregation-store/tmp-store/pmtiles-store配下を全て削除、1号のデータには一切影響なし。

**追加レビュー**: `grep -rn get_pmtiles_folder`をリポジトリ全体に再実行し、`layer=`未指定の呼び出しが意図的に対象外とした2ファイル(`check_aggregation_dirty_gap.py`・`check_covering_gaps.py`)以外に残っていないことを確認。

**未検証のまま残る部分**: downsampling_run.py/bundle.py/merge_japan_bundles.pyのlineage分岐は、それぞれ独立した単体・結合テスト(D108: 合成データによるdownsampling統合テスト、D109: 命名ロジックの単体テスト)は通過済みだが、今回のaggregation実データ出力を実際にdownsampling→bundle→mergeまで一気通貫でチェーンする検証はコスト対効果を考慮し実施しなかった(複数の実aggregationアイテムを追加処理する必要があり、1件のみでは兄弟タイルが揃わずdownsamplingの実データテストができないため)。個々のステージがいずれも実データまたは実PMTiles I/Oで検証済みであることから、十分な確度と判断。

### Resume prompt

> D110で1.5号向けlineage実装の実データリハーサルが成功(aggregation_run.py、EMIT_LINEAGE=1、実GDAL処理、期待通りのtier分布)。D107-D109の全実装が実データ・実PMTiles I/Oのいずれかで検証済み。残るタスク: 1.5号を実際に全国スケールでlaunchする前に、Hidenoriさんへの最終確認(この一連の実装内容のサマリー提示)。launch自体は別の承認ポイントとして扱うこと(1号のstars公開と同じ運用)。1号のstars公開rsync(D106)は本セッション全体を通じて無関係に並行進行中——完了したら別途報告すること。

## D111: 1号のstars公開が完全に完了 -- rsync完走・公開URL疎通確認済み

**Status**: Recorded, 2026-09-02 12:45 JST頃。D106で開始したrsyncが完走。

**内容**: `publish_rsync`スクリーンのrsyncが100%完走(220,652,140,119バイト、5時間17分49秒、平均11.04MB/s)。転送先(`stars@stars.local:/home/stars/data/mapterhorn-japan-bridge.pmtiles`)のファイルサイズが送信元と完全一致することを確認。公開URL(`https://stars.optgeo.org/mapterhorn-japan-bridge/{z}/{x}/{y}`)への疎通確認も実施——HTTP 200、`content-type: image/webp`、実際にタイルデータが返ってくることを確認した。

**1号(`01M0MWK852631SHCHPA66F21WQ`)、これでミッションコンプリート**——D74-D76の重大インシデントからの復旧(aggregation_repair_3344)、D100の大規模stale markerクライシスの発見・修正、D101-D105の一連の技術的発見(PRIORITY_MODE誤診断の訂正、TMPDIR問題の真因特定と恒久修正)を経て、D106-D111で公開完了に至った。

`stars-fd`セッションに完了報告済み。

### Resume prompt

> D111で1号のstars公開が完全に完了(rsync完走・ファイルサイズ一致・公開URL疎通確認済み)。1号のミッションはこれで完了。並行して実装済みの1.5号準備(D107-D110: レイヤー分離・lineageタイル・命名リファクタリング・実データリハーサル)は、全国スケールでの実際のlaunchの承認待ち。次のセッションはHidenoriさんとの1.5号launch可否の相談から始めること。

## D112: 1.5号起動前提条件のディスク容量確認 -- 1号のbundle-store冗長コピー(438GB)を削除、空き容量を大幅回復

**Status**: Recorded, 2026-09-02 14:20 JST頃。パイプラインが静穏な間、D109/PLAN.md §6が「起動前に確認」としていたディスク容量の事前チェックを実施。

**内容**: `Migrate-2025-04`の空き容量確認中、`bundle-store/`に1号のローカル成果物が2つ残存していることを発見——`mapterhorn-japan-bridge.pmtiles`(overview結合前の中間ファイル、217.4GB、D109以前の旧命名)と`mapterhorn-japan-bridge-with-overview.pmtiles`(公開済みの最終成果物、220.65GB)。両方ともD111でstarsへの転送・疎通確認が完了済みであり、ローカルに残す理由が無い冗長コピーと判断し削除した。

**結果**: `Migrate-2025-04`の空き容量が559GB→871GBに回復(+312GB)。`pmtiles-store`は既に1.3TB空き。1.5号の見積もり所要量(elevation ≒ 1号と同規模の~220GB級bundle-store出力+lineage分の追加、D93見積もりで本体の5〜15%)に対し、削除前は`Migrate-2025-04`側の余裕が実質250〜300GB程度とやや心許なかった(disk_headroom.pyの警告閾値200GBに近い水準)が、削除後は871GBの余裕があり、十分な安全マージンを確保できた。

### Resume prompt

> D112でディスク容量の事前確認を実施、1号の冗長なbundle-storeコピー(438GB)を削除して`Migrate-2025-04`の空き容量を871GBまで回復。1.5号のディスク容量に関する懸念は解消。PLAN.md §6の「起動前に詰めるべき点」のうちディスク容量確認は完了——残るは「純粋なクリーンビルドの所要時間の実績が無い」点のみ(1.5号自体がこれを提供する)。全国スケールでのlaunch自体はHidenoriさんの承認待ち。

## D113: 【重要・未解決】海岸線から突き出る垂直の「壁」アーティファクトを発見 -- 1号の広範囲(瀬戸内海・四国南岸・北海道日高沖・国東半島)で確認、原因未特定

**Status**: Recorded, 2026-09-02 18:30 JST頃。Hidenoriさんが公開された1号を実機(3D表示)で目視確認した結果、報告。

**発見の経緯**: Hidenoriさんが公開ビューアで複数の沿岸地域を確認したところ、海岸線から海に向かって突き出る、直線的で鋭いコーナーを持つ垂直の「壁」状アーティファクトを発見。倉橋島周辺(瀬戸内海)、須崎・中土佐(高知県、四国南岸)、幌尻岳沖(北海道日高山脈沖)、国東半島(大分県)の4地点で確認。**低ズーム(z0-7、本家Mapterhornとの接合部分)では発生しておらず、自前のz8以降のデータに限定される**ことをHidenoriさんが確認済み。

**実データ調査**: `10/918/378`タイル(北海道日高沖、42.4N/142.8E付近)を取得・デコードしたところ、開けた外洋のはずの地点で標高最大1825m(明らかに非現実的)を検出。172,456ピクセル(タイル全体の約66%)が500m超という広範囲の異常値。単発のスパイクではなく、面的な汚染。

**現時点の最有力仮説(未検証)**: 陸(jpnational1/5/10)と海(jpnationalsea/Copernicus GLO-30)のソース境界、または隣接するCopernicus DEMタイル同士の境界(1度四方の矩形グリッド、例: `Copernicus_DSM_COG_10_N44_00_E146_00_DEM.tif`)における標高の急激な不連続。北海道の例で直角コーナーを持つ壁が観測されたことは、Copernicusタイルの矩形境界と形状が一致しており、この仮説を支持する。`aggregation_reproject.py`の`gdalwarp -r cubicspline`が、こうした急な不連続付近でリンギング(オーバーシュート)を起こしている可能性がD79の市松模様調査時と同様に考えられるが、**D79とは別種・別原因の問題として扱う**(D79はGSI陸域データ内の512pxブロック境界の話、こちらは陸海境界またはソースタイル境界の話)。

**1.5号への影響(重要)**: 1.5号(D107-D110で実装済み)は`aggregation_merge.py`/`aggregation_reproject.py`(実際の標高合成・投影ロジック)には一切手を加えておらず、ソースデータも1号と同一のまま使う設計(D96)。**この問題の原因がここにあるなら、1.5号でも同じソースデータ・同じロジックから同じ結果が再現される**——Hidenoriさんへの回答として明言済み。原因を特定・修正しない限り、1.5号は「見た目の改善」を提供できない。

**対応方針(未実施)**: この問題を1.5号のスコープに追加し、`aggregation_merge.py`/`aggregation_reproject.py`の陸海境界処理を精読・実データで検証することを次回セッションの最優先課題とする。D79同様、「もっともらしい仮説」の段階に留まっており、実データでの検証(該当ピクセルの生ソースデータまで遡る、複数地点でのパターン再現性確認等)がまだ必要。

### Resume prompt

> D113で、1号の広範囲(瀬戸内海・四国南岸・北海道日高沖・国東半島)に海岸線から突き出る垂直の壁アーティファクトを発見(Hidenoriさんの実機確認による)。z0-7(本家Mapterhorn接合部分)は綺麗、自前のz8以降データに限定。最有力仮説は陸海境界またはCopernicusタイル境界での標高不連続によるcubicsplineのリンギング(未検証)。1.5号は現状aggregation_merge.py/aggregation_reproject.pyに手を入れておらず、同一ソースデータを使うため、この問題を修正しない限り1.5号でも再現する。**次回セッションの最優先課題**: この問題の根本原因を特定し、1.5号のスコープに修正を追加すること。1号のstars公開自体は既に完了済み(D111)——この問題があっても公開は取り消さない前提だが、修正が完了するまで「見た目が完璧」とは言えない状態であることをHidenoriさんも認識済み。

**追記(18:35 JST)、内水面マスク仮説の検証**: Hidenoriさんから「Copernicusが瀬戸内海を内水面扱いしているのでは」という仮説をいただき検証。まず四国南岸(開けた太平洋側)でも同じアーティファクトが出ていることから、内水面仮説だけでは説明不足(Hidenoriさん・私双方で同時に気づいた)。実際に`source-store/jpnationalsea/Copernicus_DSM_COG_10_N33_00_E133_00_DEM.tif`(須崎沖を含む1度タイル)の生データを直接確認したところ、**海岸線付近で自然な連続値(-3.67m〜602m)、`nodata`値は未設定(全域データが埋まっている)**——内水面マスクや特殊な欠損は見られなかった。

**結論**: 少なくとも四国南岸の地点では、Copernicus生データ自体に問題は無い。**アーティファクトの原因はソースデータではなく、パイプライン側の処理(`aggregation_reproject.py`の再投影、または`aggregation_merge.py`の優先順位マージ・nodata埋め込みロジック)に絞り込まれた**。次回調査では、この地点の`{tmp_folder}/{i}-3857.tiff`(reproject後の中間データ)や`merged-3857.tiff`(merge後)を実際に生成して、どの段階で不連続が生じるかを追跡すること。

**追記(18:45 JST)、「壁」の命名と決定的な切り分け**: 以後この現象を**「壁」**と呼ぶ(Hidenoriさんの命名)。

Etajima/怒和島(瀬戸内海、1枚目の画像)の座標を計算したところ`z10/889/408`と判明。これは`pmtiles-store/7-111-51/10-889-408-{13,14,15,16}.pmtiles`と完全一致し、これらのファイルは**今夜(9/1 23:47〜9/2 03:25)、`aggregation_repair_3344`/`downsampling_repair2`によって現行コードで再生成されたばかり**のデータであることが判明。

**結論**: Etajimaの「壁」は、古い世代のデータの取り残しではなく、**現行のパイプラインコード(`aggregation_reproject.py`/`aggregation_merge.py`)で再現する生きたバグ**である。Hidenoriさんの懸念(「今のツールでもflat earth現象は再現してしまう」)が実データで裏付けられた。

一方、須崎沖(四国南岸、2枚目の画像)の同一z7バケット内`10-888-408/409/411`系は8/28-29のまま(D74-D76以前、一度も再処理されていない)——こちらは「古い世代の取り残し」という別の要因が働いている可能性が残る。**「壁」は単一原因ではなく複合要因**(Hidenoriさんの見立て)という理解に至った: (1) 現行コードのバグによる「壁」(Etajimaで実証)、(2) 一部地域は古い世代のまま取り残されている問題、の少なくとも2つが併存している可能性。

**次回セッションの優先課題を更新**: Etajima(`10-889-408`関連)を対象に、`aggregation_reproject.py`のreproject直後・`aggregation_merge.py`のmerge直後の中間データを実際に生成し、どの段階で不連続が生じるかを追跡すること(現行コードのバグである以上、追跡可能なはず)。須崎沖の「古い世代取り残し」問題は、原因(1)の切り分け後に別途対応を検討。

**追記(18:35 JST)、Etajimaリハーサル再構築の結果 -- aggregation層は健全、疑いはdownsampling層または隣接マクロタイル境界に移動**: 使い捨てgeneration_id(`00TEST0000000ETAJIMA02`)でEtajima(`10-889-408-16-aggregation.csv`、1423ソースファイル、jpnational1/5/10/sea混在)に対して現行コードで`aggregation_run.run()`を実際に実行。

**reproject段階**: 全7グループが正常にreproject完了。group 4がjpnationalsea(Copernicus、`N34_00_E132_00`)で、887MB(COG+ZSTD圧縮)の実質的なデータを生成——「Copernicusが呼ばれていない」「仕事をしていない」という仮説は否定。group 0(最優先ソース)単体のスキャンでも異常なし(最大ジャンプ約70m、範囲-14.8〜838m、地形として妥当)。

**merge段階**: `aggregation_merge.py`のロジックを精読し、127行目(`merged_tile[merged_tile == -9999] = 0`)が`if 1 in boundary_tile:`という条件の内側にあり、`boundary_tile`はタイル端(edge)を明示的に除外する設計(117-120行目)であることを発見——海岸線がブロック端から端まで走る場合、無効域の入力に対してこの0埋め処理が発火しない可能性がある、という具体的なバグ候補を特定した。しかし実際に**このEtajimaアイテムの`merged-3857.tiff`を全解像度でストリップスキャンした結果、-9999の残存は0件、極端値も0件、最大ジャンプ29m——完全にクリーン**だった。この特定のバグ候補は、少なくとも今回のケースでは発火していない(別のケースで発火する可能性は排除できないが、Etajimaの説明にはならない)。

**結論と次の焦点**: aggregation層(leaf、z16)単体の合成は健全と確認。しかし公開データでは壁が見えている(Hidenoriさんの実機確認)。3Dビューアが実際にリクエストするのは粗いズームレベルのタイルであるため、**疑いは(1) downsampling_run.pyのalpha加重平均ロジック、(2) 隣接マクロタイル同士の境界(単体アイテムのリハーサルでは検証できない)、のいずれかに移った**。次回セッションでは、このEtajimaの成果物を実際にaggregation_tile.py→downsampling_run.pyまで通し、ダウンサンプル後のタイルで同様のスキャンを行うこと。

### Resume prompt

> D113のEtajimaリハーサル再構築で、aggregation層(leaf, z16)の合成は完全にクリーンと判明(-9999残存0、極端値0、最大ジャンプ29m)。公開データで見える「壁」の原因は、downsampling層(粗いズームのピラミッド生成、alpha加重平均ロジック)または隣接マクロタイル境界のいずれかに絞り込まれた。次回セッション: Etajimaのaggregation出力を実際にdownsampling_run.pyまで通し、ダウンサンプル後タイルで同様のスキャン(-9999残存・極端値・ジャンプ検出)を行うこと。使い捨てgeneration_id `00TEST0000000ETAJIMA02` の後片付け(aggregation-store/tmp-store/pmtiles-store配下)を忘れないこと。

**追記(19:00 JST)、調査の統合サマリーと最有力仮説の確立**: 今夜の一連の調査(D113本体+複数の追記)を統合する。

**確立した仮説(高確度)**: **「壁」は、最優先ソース(jpnational1、1m)が海岸線まで届いていない場所で発生する。** 実データによる裏付け:
- 壁が観測された地点(瀬戸内海Etajima、四国南岸須崎、北海道日高沖、国東半島)は、いずれも1mデータが疎/不在になりがちな地域と一致する。
- **対照実験**: 三陸海岸(Hidenoriさんの知見により1mが海岸線まで完備)を確認したところ、**壁は一切見られなかった**(自然な地形陰影のみ、ジャンプは76〜100m程度で地形として妥当)。これは強い反証可能性を持つ予測であり、実際に的中した。
- 本家`tiles.mapterhorn.com`の同一地点(Etajima)も確認したが、極端なジャンプ(1000m超級)は見られなかった——本家由来のバグではなく、このフォーク(GSI 1m/5m/10m+Copernicus合成)固有の問題と判断。

**メカニズムの手がかり**: `aggregation_covering.py`のmaxzoomは、その位置の最優先ソース(group 0)のmaxzoomで決まる(`grouped_source_items[0][0]['maxzoom']`)。1mがあればmaxzoom=16、無ければ5m/10mのより低いmaxzoom(13等)になる——**隣接するマクロタイル同士でネイティブの最大ズームレベル自体が異なりうる**。実際、`10-888-408-13.pmtiles`(古い、8/29生成、child_z=13)と`10-889-408-16.pmtiles`(child_z=16)が隣接して存在することを確認済み(ただし888-408-13は`-downsampling.csv`由来のピラミッド中間生成物であり、888番自体がaggregation leafとしてmaxzoom=13だったかは未確認——この点は次回要検証)。

**Etajimaリハーサル再構築の結果(重要)**: aggregation層(leaf, z16)単体を現行コードで再構築したところ、-9999残存0・極端値0・最大ジャンプ29mと完全にクリーンだった。**つまりaggregation層自体は健全**——壁は(1) downsampling層(粗いズームのピラミッド構築、隣接する異なるmaxzoomのアイテム同士をどう扱うか)、または(2) 隣接マクロタイル境界そのもの、のいずれかで生じている可能性が高い。単体アイテムのリハーサルでは検証できない箇所である。

**実務的な対処法の検討**: Hidenoriさんの提案「壁を検出→無効化→再生成」——Etajimaの再構築が現行コードでクリーンだったことから、**単純な再生成だけで直る可能性がある**(根本原因の完全解明を待たずに)。ただしdownsampling層まで含めた検証がまだ済んでいないため、この戦略の有効性は未確定。

**次回セッションの最優先課題(更新)**:
1. Etajima(またはEtajima+隣接する古いマクロタイル)を対象に、aggregation出力を実際にdownsampling_run.pyまで通し、ダウンサンプル後タイルで同様のスキャン(-9999残存・極端値・ジャンプ検出)を行う。
2. 隣接マクロタイル同士でmaxzoomが異なる(1mの有無による)ケースを実際に特定し、その境界でのdownsamplingピラミッド構築を追跡する。
3. 上記で原因が確定すれば、「壁のある地域を検出→該当するdownsampling/aggregation出力を無効化→再生成」という全国スケールでの実務的な修正パスを設計する(全国フル再ビルドより遥かに安価なはず)。
4. 1.5号のスコープにこの壁修正を明示的に追加する。

「壁」問題は、今夜のD100クライシス級の重要な発見であり、1.5号(またはそれ以前)で必ず対処すべき最優先事項として扱う。

**追記(19:10 JST)、仮説の統合とHidenoriさんの実地知見**: Hidenoriさんより「四国・瀬戸内海はもともと1mを作らない印象がある」との実地知見。これは今夜の全ての壁観測地点(Etajima・瀬戸内海、須崎・四国南岸)と整合する。

**統合仮説**: `aggregation_merge.py`127行目のゼロフィル/ブレンド処理が、`boundary_tile`のタイル端除外ロジック(117-120行目)により、無効域が広くタイル端まで達する場合に発火しない(D113本体で発見済みのコード上の弱点)。**1mデータが疎/不在の地域では、5m/10m/海へのフォールバックが必要な範囲が広くなり、その無効域がブロック端まで達しやすい**——この2つが組み合わさることで、1mが届かない海岸線特有の「壁」が説明できる。

ただしEtajimaのリハーサル再構築(本体参照)では-9999の残存は検出されなかったため、単純な「-9999がそのまま漏れる」ではなく、より巧妙な失敗モード(条件不発火だが値自体は別の形で汚染される)である可能性も残る。

**次回セッションの具体的な次の一手**: `aggregation_merge.py`127行目周辺の`if 1 in boundary_tile:`条件を実験的に緩和(タイル端除外を撤廃、または条件を「無効域が存在すれば常にゼロフィル」に変更)し、Etajimaで比較リハーサルを行う。これで壁が解消するか、あるいは別の失敗モードが顕在化するかを確認する。

**追記(19:15 JST)、決定的な統一仮説の確立(ダッシュボードデータとの突き合わせで発見)**: mapterhorn-monitorダッシュボードの`agg_tiles.json`(実際の被覆状況データ)をHidenoriさんが確認したところ、Etajima周辺で被覆グリッドのextentズーム自体が z10/z11/z12 と混在していることが判明。これを受けて実データを確認したところ、**同じextentズーム(z11)内でも、隣接する位置同士でmaxzoom(ネイティブ最大解像度)が異なる実例を確認**: `11-1780-800-12-aggregation.csv`(maxzoom=12)と`11-1780-803-16-aggregation.csv`(maxzoom=16)。

**確立した統一メカニズム仮説**:
1. maxzoom=16の位置(1mデータあり)は、z16まで実際のaggregationデータを持つ。
2. maxzoom=12の隣接位置(1mデータなし、5m/10m止まり)は、**z13〜z16の範囲でそもそもaggregationデータが存在しない**(ネイティブ上限を超えるため)。
3. downsamplingピラミッド構築時、z13〜z15のようなzoomレベルでは、maxzoom=16側の位置は実標高データを持つ一方、maxzoom=12側の隣接位置は(データが無いため)`downsampling_run.py`の`weight_sum > 0`判定により正しく「nodata→0m」に倒れる。
4. **この2つの間には、本来存在すべき"なだらかな遷移データ"が構造的に存在しない**——実標高値(数百m)から強制0m(海面相当)への崖が、水平距離ほぼゼロで生じる。これが「壁」の視覚的正体と考えられる。

**これは古典的な意味での「バグ」というより、「隣接するアイテム間でネイティブ解像度が異なる場合の、滑らかな接続処理が設計上そもそも存在しない」という構造的欠落**。D79・D103のようなコードの明確な誤りとは性質が異なり、`downsampling_covering.py`/`downsampling_run.py`が「アイテムごとに独立したピラミッドを積む」という設計そのものに内在する限界である可能性が高い。

**Etajima・今治周辺の両リハーサル(aggregation層単体)がいずれもクリーンだった**ことは、この仮説と完全に整合する——問題はaggregation層ではなく、まさに「異なるmaxzoomの隣接アイテム同士をdownsamplingでどう繋ぐか」という、単体アイテムのリハーサルでは originally検証できない箇所にあるため。

**1.5号スコープへの正式な追加**: 「壁」問題の修正を、D107(レイヤー分離)・D108(lineage)と並ぶ1.5号の主要スコープ項目として追加する。対処案(未実装、要設計): (a) 隣接アイテム間のmaxzoom差を検出し、低解像度側の境界付近だけ人為的に高解像度側へ滑らかに遷移させる後処理を追加する、(b) `downsampling_covering.py`の被覆生成ロジック自体を見直し、隣接アイテムのmaxzoomをできるだけ揃える方向に設計変更する、のいずれか。次回セッションでの設計検討が必要。

### Resume prompt(更新)

> D113で「壁」問題の統一仮説を確立: 隣接するaggregationアイテム間でネイティブmaxzoom(1mデータの有無)が異なる場合、downsamplingピラミッドの中間ズームで「実データ→強制0m」の崖が生じる、という構造的な欠落(バグというより設計上の限界)。Etajima・今治周辺の両リハーサル(aggregation層単体、現行コード)はいずれもクリーンで、この仮説と整合。次回セッション: (1) 実際にmaxzoom境界を跨ぐdownsamplingピラミッドを構築し、この崖が本当に再現するか実証する、(2) 再現すれば、なだらかな遷移処理の設計・実装を1.5号のスコープとして進める。使い捨てgeneration `00TEST0000IMABARI03`の後片付けを忘れないこと。


## D114: 「壁」問題の再調査 -- Opus/Fableへの委任で機序を特定、実は「3つの別々の欠陥」の合成だったと判明。対馬・五島のz8-11欠損を発見し、bundle再構築で修復着手

**Status**: Recorded, 2026-09-02 21:35 JST頃。D113の「maxzoom不一致による無ブレンドの崖」という統一仮説を、実データ検証・Opus/Fableへの委任・Hidenoriさんの実証的反論を通じて大幅に更新・訂正した。

### 経緯サマリー

D113の統一仮説(隣接アイテム間のmaxzoom差でdownsamplingピラミッド中間ズームに崖ができる)を検証すべく対馬の実アイテム`11-1758-814-12`/`11-1759-814-16`ペアの境界を直接確認したところ、z12は穏やかな値、z13は両側ともHTTP 204(データなし)という、当初の仮説では説明しづらい結果に終わった(コンパクション直前の状態)。

その後、Hidenoriさんの実機確認(壱岐・玄海、長崎半島、対馬、五島の複数スクリーンショット)により、「壁」には**タイル境界に沿った矩形の丸ごと欠損型**(対馬・五島)と、**海岸線をなぞるサブタイル解像度のジグザグ型**(長崎半島・江田島)の、見た目の異なる2系統があることが明確になった。

### alphaチャンネル調査(データ経路の直接検証)

公開タイルを直接デコードし、alpha==0の場所は例外なくelevation==0.0(分散ゼロ)、alpha==255の場所は本物の地形、という完全な二値パターンを確認。style.jsonで実際の配信ソースが`{"type": "raster-dem", "encoding": "terrarium"}`(標準MapLibre raster-dem、alpha非対応)であることも確認——**alphaはこのパイプライン独自の内部簿記であり、実際のレンダラには一切届かない**ことが確定した。webpロスレスエンコーダのアルファ落とし挙動も検証: alpha全255は3chに最適化されるが、alpha全0は正しくRGBAのまま保存される(内部の多階層ブックキーピングは壊れていない)。

### Opusへの委任(1回目) -- downsamplingのゼロフィルは数学的にno-op、真の決定箇所と新仮説を発見

`downsampling_run.py`の`avg_elevation = np.where(weight_sum>0, avg_elevation, 0)`について、Opus(claude-opus-5)に厳密な数理検証を委任。結果:

- **この行は証明可能なno-op**——weight=alpha/255が0の場所はelevation*weight=0で必ず後続の加重平均から除外されるため、ここに何を書いても後続計算に影響しない。数値的に検証済み。
- **真のゼロフィル決定箇所は`aggregation_tile.py`70-72行目**(downsamplingではない)。
- Hidenoriさんの「粗いズームに上がれば10m/Copernicusで埋まる」という前提は、このパイプラインの実際の設計(粗いソースはaggregation_merge.py内でのみ投入され、downsamplingは新規ソースを一切参照しない)と食い違うことも指摘。
- **新発見**: 公開アーカイブのTileJSONが全国一律maxzoom=16を宣言しているが、実際は西日本の広範囲(九州・四国・中国地方西部)でz13以降が丸ごとHTTP 204。3D地形表示時、欠損タイルの扱いにより地形が不自然に潰れる、という「レンダラ×タイル欠損」仮説を提示。

### Hidenoriさんの反論とFableへの委任(1回目) -- Opus説の訂正、真の機序(3系統)を特定

Hidenoriさんより「その仮説では長崎の例などタイルサイズより小さいジグザグが説明できない」と的確な反論。これを受けてFable(claude-fable-5)に、Opusの結論全文+この反論+buffer_pixels(150m実世界幅)の定量チェックを含めて再検証を委任。結果:

- **Opus説は細部で誤り**: MapLibreの実装コード(v4/v5.24)を直接確認し、204は標高0mではなく**RGB(0,0,0)=-32768mの「奈落」**になることを特定。孤立タイルなら深い穴、広域欠損(対馬・五島)なら地形全体がフラットに潰れる、という違い。
- **Hidenoriさんの反論は正しい**: 欠損タイルは幾何学的にタイル境界の矩形にしかなり得ず、サブタイルのジグザグは作れない。
- **`aggregation_merge.py`の新しい構造的バグを発見**: `boundary_tile &= eroded`が**まだ埋まっていない生の無効マスクに対してerosionをかけている**ため、ごく普通の直線的な海岸線ですら境界ピクセルが1つも残らず消える(ジグザグの有無に関係ない一般的欠陥)。「下位ソースで埋まった場所」は救われるが「どのソースでも埋まらない場所」は絶対にブラーされない、という非対称な構造。**局所で下書きした修正(ゼロフィルをゲート外に出すだけ)では不十分**——ゼロフィルをマスク再計算の**前**に行う必要がある。このバグは upstream mapterhorn/mapterhorn 本体にも存在(upstream issue化を提案)。
- 6件のリハーサル実測(-9999残存0件)と production の食い違いも解明: 長崎半島タイルのalpha=0領域(実測55,953px、elevation厳密に0.0)は、**生成当時のビルドでは海が-9999(未フィル)のまま到達していた**ことの直接証拠——現在のリハーサル再実行はproductionとは異なる(より新しい/完全な)入力で走っているため、当時の欠陥を再現できていない。
- **3系統に整理**: (A) レンダラ×タイル欠損(対馬・五島の広域欠損、-32768の奈落) / (B) データに焼き付いたハード段差(長崎・江田島のジグザグ、mergeゲートのバグ) / (C) 配信衛生問題(maxzoom誇大申告、z8-11の中抜け、RGB/RGBA世代混在)。

### Hidenoriさんの直接反証とFableへの委任(2回目) -- 対馬・五島の具体的な欠損バンドを特定

Fableの「現在の公開データに壁は見当たらない」という結論に対し、Hidenoriさんがmartin tile inspector(`https://stars.optgeo.org/?tab=tiles&inspect=mapterhorn-japan-bridge#map=7.62/33.269/130.767`)のスクリーンショットで直接反証。矩形・L字型の水色パッチが実際に存在することを実証。この座標・URLをFableに渡して再調査を依頼した結果:

- **z8〜z11が対馬・五島エリアで丸ごとHTTP 204**(z12は存在)。z13以降の既知の欠損バンドとは**別の、2つ目の欠損バンド**。
- **境界は経度129.375°ちょうど**(z6/z7タイル列境界)に厳密に一致。九州緯度帯でこれより西側のみ。沖縄・石垣は無関係(z8-12完備)。
- **z0-7スプライスは無罪**——z7タイルは本家Mapterhornと完全MD5一致を確認。
- タイル内部の水色矩形(200で返るが内部にalpha=0領域を持つもの)は、本家と突き合わせて標高データ自体の喪失は無い(海面0mが正しく透明化されているだけ)ことを確認——ただし-32768の壁リスクと見た目の悪さは残る。

### 実機調査(私自身、slate上) -- 再生成不要、bundle/merge時の取りこぼしと判明

Fableの指摘(z6 x=55/z7 x=109列の対馬・五島ワークユニットのz8-11オーバービューが未着地)を受け、実際の状態を調査:

- `aggregation-store/01M0MWK852631SHCHPA66F21WQ/`に、対象地域のz8-z11 downsampling.csv+`.done`マーカーが**大量に存在**——パイプライン上は「処理済み」扱い。
- 実際のpmtiles出力を探索したところ、**新レイヤー分離構造(`pmtiles-store/{aggregation,downsampling}/...`、D95/D107で導入)は空**だが、**1号が実際に使っている旧フラット構造(`pmtiles-store/{z7バケット}/*.pmtiles`)には該当ファイルが全て実在**することを確認(`11-1759-816-{12..16}.pmtiles`、`8-220-101-{9,10,11}.pmtiles`、`9-441-205-12.pmtiles`、`10-883-411-{13..16}.pmtiles`等)。
- **結論**: 生データの再生成は不要。1号公開当時の`bundle.py`/`merge_japan_bundles.py`の一回限りの取りこぼし(この地域の処理がその時点で未完了だった、または部分的に中断したラン)により、既に存在するデータが最終アーカイブに含まれなかっただけ、と判断。

**重大な互換性の落とし穴を実行前に発見**: 現在リポジトリ上の`bundle.py`は、今セッション中に1.5号向けD95/D107でレイヤー分離構造をglobするよう既に書き換え済み(`pmtiles-store/{aggregation,downsampling}/{datatype}/...`)。1号の実データは旧フラット構造にあるため、**このまま現行bundle.pyを実行すると1号のデータを一切拾えず、空/破損した出力になっていた**。git履歴(コミット`78a3263`、D95/D107直前)から旧版のロジックを取得し、`bundle_1go_rebuild.py`として一時的にpipelinesディレクトリに配置(本番の`bundle.py`自体は1.5号向けのまま無傷)。

### 現在の状態・次の一手

`bundle_1go_rebuild.py`(旧フラット構造対応)をslate上でscreenセッション(`bundle_rebuild`)にてバックグラウンド実行開始(4ワーカー)。完了後、既存の`merge_japan_bundles.py`(datatype='elevation'、D109版のまま互換)でbundle-storeを統合し、z0-7オーバービュー接合を経て、**再公開の可否は別途Hidenoriさんに確認する**(生データ再生成ではなく既存データの再結合のみだが、公開アーカイブの差し替えという性質上、独立した承認ポイントとして扱う)。

系統(B)(mergeゲートの構造的バグ)自体の修正はまだコードに反映していない——今回の対馬・五島修復は系統(A)(タイル欠損)の一角に対する対処であり、系統(B)(長崎半島型のジグザグ)への対処は別途、ゼロフィルをマスク再計算前に移動する修正の設計・実装・検証が必要。系統(C)(RGB/RGBA世代混在、maxzoom誇大申告)への対処も未着手。

### Resume prompt

> D114で「壁」問題を再整理: 実は(A)レンダラ×タイル欠損(-32768の奈落、対馬・五島の広域+z13以降の既知バンド)、(B)aggregation_merge.pyのboundary_tile erosionが常に境界ピクセルを消す構造的バグによるハード段差(長崎半島・江田島型、upstream mapterhornにも存在)、(C)配信衛生(maxzoom誇大申告・z8-11中抜け・RGB/RGBA世代混在)の3系統の合成と判明。対馬・五島のz8-11欠損(経度129.375°が境界)は生データが実在することを確認済みで、bundle.py(1.5号向けD107レイヤー分離済み)が1号の旧フラット構造を拾えない互換性問題を回避するため`bundle_1go_rebuild.py`(git archaeology、commit 78a3263ベース)を用意し、slate上のscreenセッション`bundle_rebuild`で再構築を実行中。**次回セッション**: (1) bundle再構築→merge_japan_bundles.py→z0-7スプライス→ローカル検証、を完遂し、Hidenoriさんに再公開の可否を確認する。(2) 系統(B)の本格修正(ゼロフィルをmask再計算前に移動、upstream issue化の検討)を設計・実装・検証する。(3) 系統(C)(RGB/RGBA世代混在、maxzoom誇大申告)への対処を検討する。1.5号のスコープにこれら全てを明示的に含める。


## D115: 対馬・五島z8-11欠損の真因発見・修正完了。git identity再発防止、get_pmtiles_folderフォールバック、publish_cycle.pyガード、Fableコードレビュー、Opus修正計画

**Status**: Recorded, 2026-09-03 07:10 JST頃。D114の「bundle再結合だけで直る」という診断が誤りだったと判明し、実際の根本原因を特定・修正した。

### D114診断の誤り

D114で「対馬・五島のz8-11データは`pmtiles-store/{z7バケット}/`に既に存在する」と確認した際、実は**経度129.375°より東側(=もともと壊れていなかった側)を確認していた**——座標取り違えのミス。Fableへの再検証委任(ローカルの`pmtiles.Reader`で直接タイル抽出)で発覚。真に欠損している西側(z8のx=219、z9のx=439等)は、`aggregation-store`にdownsampling作業項目自体(`.todo`すら)が存在しないことが判明——「結合し忘れ」ではなく「生成未実施」だった。

### bundle再構築の事故と復旧

診断誤りに気づく前、bundle.py(D107で1.5号向けにレイヤー分離構造をglobするよう既に書き換え済み)が1号の旧フラット構造データを拾えない問題を発見し、`bundle_1go_rebuild.py`(git archaeology、コミット78a3263ベース)を用意して回避。1回目の`pmtiles cluster`実行時、**ブートディスク(`/`、228GB)がほぼ満杯(残り1.2GB)なのに気づかずTMPDIRを明示指定しなかった**ため、310GBのアーカイブが破損(`pmtiles verify`で発覚: `Tile data offset=... out of bounds`)。原因は`/private/var/folders/.../T/`に残っていた97GBの孤立一時ファイル(過去のcluster失敗の残骸)。削除して復旧、TMPDIRを最初から`/Volumes/pmtiles-store/tmp-store/writer-scratch/`に固定してbundle→merge→clusterをやり直し、2回目は成功(`pmtiles verify`クリーン)。

### 真の根本原因(downsampling_covering.pyのチェーン機構)

`downsampling_covering.py`の`get_extents_from_coverings()`は、ズームレベルごとにネイティブaggregation.csvまたは既存downsampling.csv(トレイリング数字が一致するもの)をglobで拾い、`mercantile.simplify()`で近隣アイテムを結合しながらズームを1段ずつ下げていく設計。対馬・五島周辺では、この結合が**z6タイル(54,25)まで一気に単純化**され、`6-54-25-{8,9,10,11}-downsampling.csv`という、個々のアイテム名とは全く異なる名前で出力されていた——探すべきファイル名のパターンを見誤っていたことが、当初「データがない」ように見えた一因。

実際にはこれらのファイルは存在し(`.todo`付き)、**一度も処理されていなかった**。理由: `6-54-25-11-downsampling.csv`が参照する133ファイルのうち2つ(`7-108-50-12.pmtiles`、`7-108-51-12.pmtiles`——東シナ海、九州西方沖の完全な海域、jpnationalseaのみ)が存在せず(`.done`マーカーはあるのに実ファイルが無い、stale markerの典型例)、`DOWNSAMPLING_STRICT=1`によりz11レベルの処理全体がスキップされ続けていた。z11が生成されないため、それを入力とするz10、z9、z8も連鎖的にスキップ——全国で「未完了」だったのはこの4項目のみ(progress.jsonのD98由来「4件not_ready」と一致)。

**修正**: この2つの海域アイテムの`.done`マーカーを削除し`aggregation_run.py`で再生成(問題なく完了)。その後`downsampling_run.py`を再実行し、z11→z10→z9→z8の4段階すべてが正常完了。**全国のdownsampling未完了項目が0/8223になった**。実データ検証(ローカルpmtiles直接デコード)で、対馬・五島の該当座標すべてに標高分散22〜122、最大886mの実地形が入っていることを確認——空洞ではなく本物のデータ。

### get_pmtiles_folder フォールバック(1.5号で撤去予定)

新たに生成されたdownsampling出力は、D107で書き換え済みの`utils.get_pmtiles_folder()`が新レイヤー構造(空)を向いてしまい、1号の実データ(旧フラット構造)を読めない問題に直面。「別ファイルにフォークする」パターン(`bundle_1go_rebuild.py`)をこれ以上増やすことへの懸念(Hidenoriさん)を受け、`utils.get_pmtiles_folder()`本体に**z7バケット単位のフォールバック**(新レイヤー構造にバケットが無ければ旧フラット構造を試す)を追加。呼び出し側(`downsampling_run.py`等)は無変更。**「remove before flight」**——(B)(C)修正・1.5号ローンチ完了後、1号を読む必要がなくなった時点でこのフォールバックを削除する、とコード内コメントに明記済み。新規生成された`6-54-25-{8..11}.pmtiles`は旧フラット構造(`/Volumes/pmtiles-store/6-54-25/`)へ手動移動し、1号の他データと揃えた。

### publish_cycle.pyの危険性とガード

Opusへの計画立案委任で、**`publish_cycle.py`を現状のまま実行すると、ローカル最終アーカイブ削除→bundle.pyが新レイヤー構造(空)に対して0件生成(エラーにならず正常終了)→merge_japan_bundles.pyも空入力→`ssh stars rm -f`で公開版削除→rsyncは削除済みファイルを送ろうとして失敗、という「3箇所すべて消えて何も残らない」という最悪パスが判明**。`publish_cycle.py`の`main()`冒頭に即座に`sys.exit(1)`する安全装置を追加、コミット済み。D107以降の命名変更(`.z8plus.pmtiles`)への追従およびz0-7スプライス手順の欠落も含め、本格修正はPhase 1(Opus計画)で対応予定。

### git identity の再発とpre-commitフック導入

D114執筆時、リポジトリのgit設定(`fujimura.hidenori@gmail.com`)が**公開リポジトリへの実メールアドレス露出**という別の問題を引き起こしていたと判明(Hidenoriさん指摘)。GitHub提供のnoreplyアドレス形式`<ID>+<login>@users.noreply.github.com`(`gh api user`でID=18297確認)に切り替え——表示名の誤り(handygeospatial表示)と実メール露出、両方を同時に解決。**その後も設定が2回、静かに元に戻る事象を確認**(原因未特定)。cafebabe(別セッション)の提案でpre-commitフック(`user.email`が期待値と異なればコミット拒否)をmapterhorn-japan-bridge・hfu-mapterhorn・mapterhorn-monitorの3リポジトリに導入——実際に今夜のうちに1回、フックが不正な設定を検知してコミットをブロックし、有効性を実証した。既にpush済みの数コミット分(誤った実メールアドレスを含む)の履歴書き換えは、Hidenoriさんの判断で見送り。

### Fableによる独立コードレビュー(D116候補、未反映の詳細多数)

Fableへ`hfu-mapterhorn/pipelines`全体の読み取り専用コードレビューを依頼、16件の指摘を受領(P0緊急1件は即対応=97GB孤立ファイル削除、残り15件は未着手)。主な指摘: `extract_z8plus.py`/`build_global_overview.py`のTMPDIR未設定、`utils.run_command()`が終了コードを見ていない(source_to_cog.py等での変換失敗後の無条件delete)、`aggregation_merge.py`の`merged-3857.tiff`が非原子的書き込み(D48のresumeロジックが部分書き込みを完了と誤認しうる)、`remove_dangling_pmtiles.py`が最新世代のみを基準に削除する危険な設計、`.done`マーカーがdatatypeでスコープされておらず1.5号のlineageパスが無視される、等。詳細はセッションログ参照、次回セッションでの正式なDECISIONS.md反映が必要。

### Opusによる修正順序計画(未反映、詳細多数)

上記コードレビュー結果と(B)(C)を統合した、フェーズ分けされた修正計画をOpusに依頼・受領。要旨: Phase 0(今夜の続き)→Phase 1(publish_cycle.py本格修正・TMPDIRラッパー・remove_dangling_pmtiles.py安全化などの「即座の危険物処理」)→Phase 2(`run_command`終了コードチェック等、複数日運用への耐性強化、1.5号前に必須)→Phase 3((B)の本格修正、1.5号のクリティカルパス)→Phase 4(1.5号ローンチ)。Hidenoriさんの判断が必要な項目(H1〜H6)を明示的に分離。詳細はセッションログ参照。

### (B)修正: Opus設計→Fable実装検証(進行中)

`aggregation_merge.py`のboundary_tileバグに対し、Opusが精緻な設計(122-124行目の削除が本質、書き換えではない。数値例で144m幅の緩やかなランプへの変換を実証)を作成。Fableへ実装・合成テスト・実データ(江田島)リハーサル・visual確認を依頼、結果待ち。副次的発見: downsampling時のalpha加重平均で陸地標高が海側に「にじみ出る」別メカニズムの可能性も指摘され、この修正で同時に解消するか検証中。

### 現在の状態

`bundle_1go_rebuild.py`(3回目、対馬・五島の真の修復データを含む)実行中(screen: bundle_rebuild3)。完了後: merge_japan_bundles.py→pmtiles cluster→pmtiles merge(z0-7接合)→ローカル検証(Fable)→Hidenoriさんに公開可否確認。(B)修正はFableの実装・検証待ち、完了後に別途this pipelineへの組み込みを判断。Hidenoriさんより今後12時間の自律モード運用を指示されている。

### Resume prompt

> D115で対馬・五島z8-11欠損の真因を特定・修正完了: `downsampling_covering.py`が地域全体をz6タイル(54,25)の連鎖アイテムに単純化し、東シナ海の2つの海域アイテム(`7-108-50-12`/`7-108-51-12`、stale .doneマーカー)がDOWNSAMPLING_STRICTでチェーン全体をブロックしていた。再生成し全国0/8223未完了に。実データ検証済み(標高分散22-122、最大886m)。`utils.get_pmtiles_folder()`に旧フラット構造への一時フォールバックを追加(1.5号完了後に削除予定、コード内に明記)。`publish_cycle.py`に安全装置追加(現状のまま実行すると全アーカイブ消失のバグを発見)。git identity再発防止のpre-commitフックを3リポジトリに導入(実際に1回機能を確認)。Fableのコードレビュー16件・Opusの修正順序計画を受領済みだが、DECISIONS.mdへの詳細反映は次回セッションの課題として残る(セッションログ参照)。(B)修正はOpus設計→Fable実装検証が進行中。**次回セッション**: (1) bundle_rebuild3→merge→cluster→verify→公開判断を完遂、(2) Fableの(B)実装検証結果を確認し本番反映を判断、(3) Fableコードレビュー16件・Opus修正計画をDECISIONS.md/PLAN.mdに正式反映、(4) Phase 1(publish_cycle.py本格修正等)に着手。


## D116: (B)修正(aggregation_merge.pyのboundary_tile侵食ゲートバグ)を本番へ導入

**Status**: Recorded, 2026-09-03 07:24 JST頃。D114/D115で特定した「壁」現象の defect (B) に対するOpus設計→Fable実装検証が完了し、`hfu-mapterhorn/pipelines/aggregation_merge.py`へ導入・コミット済み(`1b6e4e1`)。

### 修正内容

122-124行目(旧コード)で、マージ済み最終状態(`merged_tile`)から`binary_mask`/`eroded`を再計算し、それを`boundary_tile`にANDしていた処理を削除。この再計算は、恒久的に埋まらない領域(=実際の海岸線で、優先順位の低いソースも一切届かない側)に隣接する境界を数学的に必ず消してしまう(Opusの証明)——結果、その境界は本来のブラー処理(緩やかな陸→海のランプ化)を経ないまま`-9999→0`の穴埋めだけを受け、ブロック境界に鋭い崖として現れていた。ブロックループ中に段階的に蓄積される`boundary_tile`(98-115行目)は元々正しいため、削除のみで足り書き換えは不要(Opusの設計方針どおり)。あわせて`-9999→0`の穴埋めをブラーの発火条件から外して常時実行に変更、ゲートを`boundary_tile.any()`に変更、`blur_fits_in_overlap`ガード(maxzoom≤11でのみ到達しうるが実運用では未到達、`aggregation_covering.py`のmacrotile_z=12フロアにより)を追加。D113の単一ソースグループ修正(`contains_nodata_pixels`判定付きの再エンコード)も、誤った批判コメント(117-120行目のフレームゼロ化を犯人扱いしていた)を修正した上で正式採用。

### 検証結果(Fable、実装後に私自身も再実行し再確認)

- **合成テスト**(江田島規模、762×762、maxzoom16、overlap125、sigma30): 全PASS。海岸ケースで残留-9999が275,844px→0、最大隣接段差が(公開相当の)100mの崖→1.43mへ。healed seamケースは新旧でbit-identical。全面nodataケースは0出力・ブラー未発火(0回)を確認。
- **実データリハーサル**(使い捨てID `00TEST0000000ETAJIMA03`、作業後削除済み): 江田島`10-889-408-16`(1,423ソース)・長崎半島`11-1762-826-16`(1,089ソース)いずれも新旧**bit-identical**。今回のリハーサル入力には常に海グループ(jpnationalsea)が全域を埋めているため、バグの発火条件(恒久的未充填領域)自体が発生しない——「改善効果」は合成テストのみで証明されるが、「退行なし」の強い証拠として成立する。
- **副次発見**: downsampling時のアルファ加重平均によるにじみ出し(陸地標高が海側に部分的に漏れ出る、独立した第二のメカニズム)も、この修正で副次的に解消されることを確認。海が透明0mから不透明0mになる仕様変化を伴う(raster-dem描画自体には影響なし、タイルインスペクタの見た目のみ変化)。
- **ガード到達可能性**: 全生成IDの最小maxzoomは12(z12でbuffer_pixels=7、4·sigma=4<7で条件を満たさない)——`blur_fits_in_overlap`ガードは現状デッドコードと確認済み。

### 導入時のインシデント(aalto/slate取り違え)

Hidenoriさんへ「slate上で以下のcpコマンドを実行してください」と提案したところ、実際にはローカル(aalto)で実行してしまっていたことが判明。ただしコマンドが参照するパス(`/Volumes/Migrate-2025-04/...`、`/tmp/aggregation_merge_new.py`)はaaltoに一切存在しないため、単にエラーで終わり、データ損失や誤ったファイル上書きは発生しなかった(確認済み)。最終的にHidenoriさんの承認を得て、Claude自身がslate上でBash経由により、バックアップ作成→インストール→合成テスト再実行→コミットの一連の手順を完遂した。

### 現在の状態

`aggregation_merge.py`の(B)修正は本番へ導入・コミット済み。今後の`aggregation_run.py`実行(1号の追加repairおよび将来の1.5号)から新コードが有効になる——ただし現在進行中の`bundle_rebuild3`はすでに計算済みのpmtilesファイルを束ねる工程であり、この修正の影響を受けない。(C)(serving hygiene: RGB/RGBA混在・maxzoom over-declaration)は未着手。Fableコードレビュー16件・Opus修正順序計画の詳細反映は引き続き次回セッションの課題。

### Resume prompt

> D116で(B)修正(`aggregation_merge.py`のboundary_tile侵食ゲートバグ)を本番へ導入完了(コミット`1b6e4e1`)。合成テスト全PASS(残留-9999 275,844px→0、崖100m→1.43m)、実データリハーサルはbit-identical(今回の入力では発火条件が発生しないための「退行なし」証拠、改善効果自体は合成テストで証明)。副次的にdownsampling時のアルファにじみ出しも解消(海が透明0m→不透明0mへ仕様変化、renderingには無影響)。導入手順中、Hidenoriさんが提案コマンドをslateでなくaaltoで実行してしまう小さな取り違えがあったが実害なし(パスが存在せずエラーで終了)、最終的にClaudeがslate上で承認を得て実行・検証・コミット。**次回セッション**: (1) bundle_rebuild3→merge→cluster→verify→公開判断を完遂、(2) (C)(serving hygiene)着手を検討、(3) Fableコードレビュー16件・Opus修正計画をDECISIONS.md/PLAN.mdに正式反映、(4) Phase 1(publish_cycle.py本格修正等)に着手。


## D117: 【重要】公開中の1号アーカイブから西日本z13以降が丸ごと欠落していたと判明(9/2のENOSPC中断マージが原因)。in-flight rebuildで修復見込み

**Status**: Recorded, 2026-09-03 08:00 JST頃。系統(C)の実データ調査をFable(claude-fable-5)に委任した結果、当初「配信衛生の軽微な問題」と想定していた範囲を超える、**現在公開中のライブサイトに実在する広範な欠落**を発見した。

### 発見1a: 西日本z13以降がライブサイトから丸ごと欠落(新発見、重大)

`aggregation-store`の6,373アイテム全数を対象に、各アイテム自身の宣言child_zでライブサーバを実測した結果、**1,621件(25.4%)が自身の宣言child_zでHTTP 204**。全てz≤12は200・z13以降は204という一貫パターンで、z6タイル単位で完全に二分される:

- **100%欠落**: `6-53-27`(24件)・`6-54-25`(89)・`6-54-26`(81)・`6-54-27`(152)・`6-55-24`(3)・`6-55-25`(784)・`6-55-26`(318)・`6-55-27`(14)・`6-56-23`(154) の9バケット
- **0%欠落**: 他13バケット全て

地理的には**九州・沖縄・四国・中国地方西部が全域、近畿・北海道の一部**が該当。経度135°E以西のz13-16がまるごと欠けている状態。

**根本原因(ログから直接確認、推測ではない)**: 現在公開中のアーカイブは`merge_bundles3.log`(9/2 05:38)が生成したもので、これは**23ファイル中わずか14ファイル**(東日本13バケット+`planet.pmtiles`)しかマージしていなかった。直前の`merge_bundles2.log`(9/2 05:07)が23ファイル全てのマージを試みてENOSPCでクラッシュしており、その後西日本9バケットのファイルが(容量確保のためとみられる)削除され、残った14ファイルのみで再マージ・再公開されたと判明。**`merge_japan_bundles.py`は`bundle-store/*.pmtiles`を無条件でglobするのみで、対象カバレッジに対する完全性チェックが一切ない**ことが根本原因。西日本はz≤12のみ`planet.pmtiles`経由(child_z≤12のアイテムは全て`planet.pmtiles`に統合される設計、`bundle_1go_rebuild.py`)で生きていたため、完全に真っ黒ではなく「z13以降だけ抜けている」形で見えていた。

**データ自体は無傷**: 欠落している1,621件全てについて、aggregation側のpmtilesファイルは`.done`マーカー付きでローカルに実在(サイズも正常、例: `10-880-411-16.pmtiles` 257MB)。**再生成は一切不要**、公開時のマージ範囲の問題のみ。

**修復状況**: 既に進行中の`bundle_rebuild3`(D115/D116からの継続、対馬・五島の真の修復を含む)が、西日本9バケットを含む**22地域バケット+planet.pmtiles、計23ファイル全て**を生成中であることを確認(2026-09-03 07:53時点でbundle-store配下に23ファイル全て存在、うち`6-55-25`74.5GB・`6-56-25`79.1GB・`6-57-23`53.9GB・`6-56-24`49GBなど西日本の大容量バケットも順調に成長中)。**次工程(`merge_japan_bundles.py`)の実行前に、23ファイル全ての存在・サイズ妥当性を手動で確認してから進める**ことで、9/2と同じ事故の再発を防ぐ。

### 発見1b: maxzoom宣言はアーカイブ全体の実測最大値であり、地域ごとの設定機構がない(構造的、設計判断が必要)

`aggregation_covering.py`のソース解像度別ズーム決定ロジック(1m→16、5m→14、10m→13、Copernicus海域→12)を確認、800件のcovering CSVで検証した結果、child_zは地域のソース解像度に応じて完全に決定論的(全国分布: z16=31.5%、z14=8.8%、z13=24.5%、z12=35.1%)。公開されているz16という「全国一律」宣言は、実は`pmtiles merge`がアーカイブ全体の実測最大値をTileJSONメタデータとしてコピーしているだけで、地域別maxzoom宣言の仕組み自体が存在しない。1aの修復後も、child_z=12-14止まりの地域(全体の約68%)では3Dクライアントがz15/16を要求してHTTP 204を受け取り続け、defect (A)の「奈落」現象の一因であり続ける。対処案(宣言maxzoomを地域別に下げる/アーカイブを地域別にoverzoom充填する/クライアント側での204ハンドリング)は設計判断が必要、次回Opus委任予定。

### 発見3: RGB/RGBA世代混在 — レンダリングには無害、だが実在する不整合と特定

700枚超のタイルを78個のローカルアーカイブ(mtime層別サンプリング)+ライブ15枚で直接デコードし検証:

- **3ch/4chの分岐自体はWebPロスレスエンコーダの挙動のみ**(D114の結論どおり、全ライターは常にRGBA出力、alpha全255時のみ3chに最適化)——ビンテージを示す指標ではない。
- **-9999の漏洩は皆無**: alpha=0の1,456万px全てが厳密に0.0m。`aggregation_tile.py`のゼロフィル処理(コミット`717f52f`、8/9)は本番ビルド全てより前に導入済みのため、構造的にありえない。
- **D114が仮定した「本物の分裂」は実在すると確認、ただしメカニズムを訂正**: コードのビンテージ差ではなく**入力データのビンテージ差**——マクロタイル構築時に`jpnationalsea`(Copernicus)が揃っていたかどうかで、海が「透明nodata(alpha=0、0.0m)」か「不透明Copernicus実測値(alpha=255、負値含む実データ)」かが決まる。実例: ライブz12 `12/3554/1634`(江田島/瀬戸内、71%透明)と隣接`12/3556/1634`(完全不透明・実測値)が現在同時に公開中。この境界はマクロタイル列単位(列888の葉タイル=8/29の旧ビルド・不完全な海、列889=8/31-9/2の修復済み・完全不透明)——地理的にもビンテージ的にも綺麗な帯にはならず、macrotile単位で細かく混在。
- **追加で発見した懸念点(設計に関わる)**: (i) **ズーム間の不整合**——8/31-9/2のaggregation修復後、z≤12のoverviewが再downsamplingされていない箇所が多数あり、同一地点でz12は旧ビンテージ・z13-16は新ビンテージという状態が起きている(`9-444-204-12.pmtiles`8/29のまま vs `10-889-408-16`8/31)。D113の壁材料だった日高沖`12/3676/1515`もこの「古いoverviewがまだ生きている」実例。(ii) D116の(B)修正は今後の海の扱いを「不透明0m」に統一するため、今後の部分修復のたびに第三のビンテージが増えうる——overviewの再構築を伴わない限り。

**判定**: raster-dem/terrarium(alphaを無視)としてのレンダリング結果には影響なし(いずれも約0mに復号され3D地形出力は同一)。ただし(i)タイルインスペクタでの視覚的な水色パッチ(Hidenoriさんが実見したもの)、(ii)downsampling時のalpha加重平均によるにじみ出し(D116で言及済みの別メカニズム)、(iii)将来の差分検証の信頼性低下、という3点で実害のある衛生問題。対処は「エンコーダ/デコーダの問題」ではなく「**再構築の一貫性問題**」——修復のたびに影響範囲のoverviewを確実に再downsamplingする運用/仕組みが必要。

### 現在の状態・次の一手

`bundle_rebuild3`は西日本を含む全23ファイルを生成中、順調。**次工程(merge_japan_bundles.py実行前)で23ファイル全ての存在・サイズを手動確認**してから進める(9/2の再発防止)。1b(地域別maxzoom宣言)・3(overview再構築の一貫性)への対処設計はOpusへ委任予定。Fableのコードレビュー16件・Opusの(B)修正順序計画のDECISIONS.md正式反映は引き続き次回セッションの課題として持ち越し。

### Resume prompt

> D117で、公開中の1号アーカイブから**西日本(九州・沖縄・四国・中国地方)のz13以降が丸ごと欠落**していたことを発見。原因は9/2のENOSPCで中断したマージが23ファイル中14ファイルのみで再実行されたこと(`merge_japan_bundles.py`に完全性チェックが無いのが根本原因)。データ自体は無傷、再生成不要。既に進行中の`bundle_rebuild3`が23ファイル全てを生成中で、この欠落を修復する見込み(2026-09-03 07:53時点で全23ファイル存在・成長中を確認)。加えて、maxzoom宣言が地域別でなく全国一律(実測最大値)である構造的問題、およびRGB/RGBA(海のalpha)の世代混在がoverview再構築の一貫性欠如に起因することを特定——いずれもレンダリングには無害だが実在する衛生問題、設計判断が必要。**次回セッション**: (1) bundle_rebuild3完了後、merge_japan_bundles.py実行前に23ファイル全ての存在・サイズを手動検証してから進める(9/2事故の再発防止)。(2) merge→cluster→verify→公開判断を完遂。(3) 地域別maxzoom宣言・overview再構築一貫性の設計をOpusへ委任。(4) Fableコードレビュー16件・Opus修正計画をDECISIONS.md/PLAN.mdに正式反映。


## D118: 1号アーカイブ再構築完了・ローカル検証全項目PASS。公開承認待ち

**Status**: Recorded, 2026-09-03 10:50 JST頃。D117で発見した西日本z13+欠落、およびD115/D116のTsushima/Goto修復を含む、1号アーカイブの完全な再構築が完了し、Fableによるローカル検証で全項目PASSした。

### 再構築工程

`bundle_1go_rebuild.py`(西日本9バケット含む全23地域バンドル+planet.pmtiles生成、47分)→`merge_japan_bundles.py`(23ファイル全ての存在をコミット前に手動確認してからマージ、2,568,061タイル・310.6GB)→`pmtiles cluster`(TMPDIRを`/Volumes/pmtiles-store/`側に固定、99.947%のディレクトリ効率)→`pmtiles verify`(クリーン)→`pmtiles merge`(global-overview-backup.pmtilesでz0-7スプライス、292GB・48分)→`pmtiles verify`(クリーン)。最終アーカイブ`mapterhorn-japan-bridge.pmtiles`313.9GB、ヘッダ: min/max zoom 0/16、clustered:true、2,581,585タイル。

### Fableによるローカル検証(公開前) — 全項目PASS

- **西日本z13+の実在確認**: 9バケット全てから21サンプル(与那国・石垣・宮古・那覇・名護・奄美・五島・対馬・竹島・広島・福岡・松山・姫路・桜島・屋久島・南大東・松前・奥尻・積丹)、20/21が実データ返却・地形的に妥当な標高(桜島1114m・屋久島1935mなど山頂標高も正確)。空だった1件(与那国z15)はソース解像度境界(与那国はz13止まりが正しい、バグではない)。**ライブサーバとの突き合わせで、与那国z13・広島z13・桜島z13が現在ライブでは204(データなし)であることを直接確認**——修復対象のバグを実証。
- **Tsushima/Goto z8-11回帰確認**: D115/D116で修復した8座標全てで実地形を再確認(標高分散22.7-122.4、最大886.5m)。**重要な追加発見: 現在ライブのアーカイブはこの8座標全てで204を返す**——つまりライブサイトのTsushima欠損は、これまで文書化していた「z13以降のみ」より深刻で、z8-11も含めて丸ごと欠落していた。今回の再構築はこれも合わせて修復する。
- **東日本の回帰確認**: 影響を受けていなかった3バケットから8サンプル、うち5件がライブと完全にbyte一致(仙台・札幌・名古屋・富士山・東京)——今回の再構築が既存の正常動作を一切壊していないことを確認。
- **z0-7グローバルオーバービューの健全性**: z0/0/0・アルプスz4・ヒマラヤz5・日本z4-7を確認、全て正常な地形データ。スプライスの破損なし。

### 現在の状態・次の一手

**公開判断待ち**——Hidenoriさんの承認を得てから、`bundle-store/mapterhorn-japan-bridge.pmtiles`(313.9GB)をstarsへ手動rsyncする(`publish_cycle.py`はD115で発見した重大バグにより現状使用禁止、ガード済み)。Fableの補足指摘: 中間ファイル`mapterhorn-japan-bridge.z8plus.pmtiles`(310.6GB)がbundle-store内に残っているため、rsync対象を最終ファイルのみに限定する必要がある(誤って中間ファイルを送らないよう注意)。公開後、この中間ファイルはディスク容量確保のため削除予定。

系統(C)の残課題(地域別maxzoom宣言・overview再構築一貫性)への対処設計、Fableコードレビュー16件・Opus修正順序計画のDECISIONS.md正式反映は、公開完了後に着手する。

### Resume prompt

> D118で1号アーカイブの再構築が完了(西日本z13+欠落・Tsushima/Goto z8-11欠損の両方を修復、313.9GB)。Fableのローカル検証で西日本21サンプル・Tsushima/Goto8座標・東日本回帰8サンプル・z0-7オーバービュー全てPASS(東日本5件はライブとbyte一致)。**ライブアーカイブのTsushima/Goto欠損はz8-11全域に及んでいたことが新たに判明**(これまでの認識より深刻、今回修復済み)。**次のアクション**: Hidenoriさんの公開承認を得て、`bundle-store/mapterhorn-japan-bridge.pmtiles`(313.9GBのみ、中間ファイルz8plus.pmtilesは含めない)をstarsへ手動rsync。公開後、系統(C)残課題の設計・Fable/Opus成果物のDECISIONS.md正式反映に着手する。


## D119: 系統(C)の設計完了(Opus) — maxzoom宣言・overview鮮度問題。当初想定を訂正、949件のstale overviewを定量化

**Status**: Recorded, 2026-09-03 13:35 JST頃。D117のFable調査を受け、Opus(claude-opus-5)へ(C)の修正設計を委任した結果、当初のブリーフィングにあった前提の一部が誤りだったと判明し、より正確で実装可能な設計が得られた。

### ブリーフィングの訂正

- **地域別maxzoom宣言は実現不可能と確定**: TileJSON・PMTilesヘッダ・martin・MapLibreの全層でスカラー1個のmaxzoomしか表現できない。さらに`pmtiles verify`(公開runbookの必須ステップ)が「ヘッダのmaxzoomはアーカイブ内の実際の最深タイルと厳密一致しなければならない」を強制することを実験で確認(`maxzoom=11`宣言は`maxzoom=13`の実データに対し検証エラーで拒否)——「全国一律で低いmaxzoomを宣言する」という選択肢も**不可能**と判明。
- **downsampling_covering.pyのチェーン機構は実は無関係**: `write_downlsampling_todos()`は意図的に呼ばれておらず、その出力を読むコードも存在しない、事実上のデッドコード。実際のゲートは`downsampling_run.py`の`.done`ファイル存在チェックのみ(中身は空、何から作られたかの記録が一切ない)。

### 発見1: maxzoom過大宣言の実態は「面積の2.4%」——修正コストは軽微

アイテム数ベースでは「68%がz16未満」に見えるが、**面積ベースでは91.1%が「海洋のみ(Copernicus)」で、実際に陸地・海岸でz16に届かないのはわずか2.4%**。この部分をz16まで最近傍アップサンプリングで充填するコストを実測: **+2.6GiB(現在313.9GBの+0.8%)、+879,504タイル**。これで陸地・海岸線上は宣言(z16)が完全に真実になる。開放海域(91.1%)まで充填する場合は追加+13.7GiBだが、タイル数が13.5倍に増えるため、まず定数値タイルの比率を実測してから判断すべき(設計内に実験手順を記載)。

### 発見2: overview鮮度問題の実態——今まさに公開承認待ちのアーカイブに949件のstale overviewが含まれる

`.done`マーカーが「いつ・何から作られたか」を一切記録しないため、リーフデータが修復されても上位のoverviewが再構築されない、という問題を実際の依存グラフを歩いて定量化した結果: **全8,223件のdownsamplingアイテムのうち949件(11.5%)が現在stale**(依存する入力より20〜228時間古い)。z8〜z14に分布、z15は全て新鮮(直近の修復後に再構築されたため)。

**これは今回公開しようとしているアーカイブそのものに既に含まれている状態**——ただしrenderingには無害(alphaはraster-demで無視される)であり、現在ライブのアーカイブに対する後退でもない。Opusの提言: 「この数字を開示した上で公開承認を得るべき」。

### 発見3: D117の根本原因(merge_japan_bundles.pyの無検証glob)への直接対処法、および新たなリスク

- `meta-store/bundle/*.json`(各地域バンドルが成功時のみ書き込む、サイズ・md5・zoom付きマニフェスト)を使った完全性チェックを`merge_japan_bundles.py`に追加する設計(約2時間で実装可能、費用対効果が本報告中で最高)。
- **新たなリスクを発見**: `get_pmtiles_folder()`のD115フォールバックは`z>=7`でのみ発火するため、**z<7の1号ファイル(z6の`6-54-25-{8..11}.pmtiles`等、67ファイル)が現在も新レイヤー構造からは見えない状態**。`DOWNSAMPLING_STRICT=1`下では、D115と同じ形のデッドロックが再発しうる潜在リスクとして特定(まだ発現していない)。対処設計も含めて提示。
- D115で手動移動した`6-54-25-{8,9,10,11}.pmtiles`が実は誤ったディレクトリ配置(z7バケット形式にz6ファイルを置いている)だったことも判明。

### 実装優先順位(Opus提言)

1. **(今回の)公開を進める**——上記のstale overview 949件を開示した上で承認を得る、それ以外はブロッカーではない
2. `merge_japan_bundles.py`の完全性チェック追加(D117根本原因への直接対処、~2時間)
3. `get_pmtiles_folder()`のz<7ギャップ修正(~30分、新規デッドロックリスクの予防)
4. overview鮮度マニフェスト+無効化ロジック(~半日設計+バックログ8時間の再構築、今後は自動化)
5. style.jsonでのmaxzoom明示的ピン留め(~30分)
6. 沿岸部z16充填(P1.B、~1日、+2.6GiB) — 1.5号の機能として実装する案が有力
7. 開放海域充填の要否判断(定数値タイル比率の実測が前提)
8. Fable残り15件・Opus未実施フェーズへ

### Fable16件・Opus旧計画の内容について

DECISIONS.md・PLAN.md・HANDOVER.md全てを検索したが、D115が要約した内容以外は**リポジトリ上にもう残っていない**(セッションログのみ)ことを確認。D115本文から復元可能な範囲(6/16項目の具体名、フェーズ見出しのみ)を本設計内に再録済み。H1〜H6の内容自体は復元不可。

### 現在の状態・次の一手

**公開判断は引き続きHidenoriさんの承認待ち**(stale overview 949件の情報を開示済み、ブロッカーではない)。承認後、上記優先順位に沿って2〜3(merge完全性チェック・get_pmtiles_folderギャップ修正)から着手予定。

### Resume prompt

> D119でOpusが(C)の修正設計を完了。要点: (1)地域別maxzoom宣言・全国低maxzoom宣言はいずれも技術的に不可能と確定(pmtiles verifyがヘッダ=実データ厳密一致を強制)。実質的な対処は陸地・海岸(面積2.4%)のみz16までアップサンプリング充填(+0.8%容量)。(2)overview鮮度問題は`.done`マーカーが中身空のtouchであることが原因、**現在公開承認待ちのアーカイブ自体に949/8,223件(11.5%)のstale overviewが既に含まれる**(renderingには無害、後退でもない)ことを定量化。マニフェストベースの無効化ロジックを設計(バックログ解消~8時間、今後は自動)。(3)D117の根本原因(merge_japan_bundles.pyの無検証glob)への直接対処法(meta-store/bundle/*.jsonを使った完全性チェック、~2時間)と、新たなリスク(get_pmtiles_folderのz<7ギャップ、67ファイルが不可視)を発見。優先順位: 公開→merge完全性チェック→get_pmtiles_folder修正→overview鮮度マニフェスト→style.jsonピン留め→沿岸z16充填(1.5号候補)→開放海域充填(要判断)。**次のアクション**: 公開承認(949件開示済み)、承認後は優先順位2-3から着手。


## D120: Fableコードレビュー・Opus修正計画の正式記録(D115で言及のみだった内容の整理・一本化)

**Status**: Recorded, 2026-09-03 21:40 JST頃。D115で「詳細はセッションログ参照、次回セッションでの正式なDECISIONS.md反映が必要」と持ち越していた項目。当該セッションログ自体はもう参照できない(D119で確認済み: DECISIONS.md/PLAN.md/HANDOVER.mdのどこにも原文は残っていない)ため、**D115・D119それぞれの散文に残っていた内容を突き合わせ、これ以上復元できない前提で一本化した最終版**として記録する。

### Fableによる読み取り専用コードレビュー(16件中、復元できたのは6件)

D115時点で「16件の指摘を受領」と記録されていたが、原文リストは失われており、以下の6件のみがD115/D119の散文から再構成可能:

| # | 指摘内容 | ファイル | 状態 |
|---|---|---|---|
| 1 | 97GBの孤立一時ファイル(過去のcluster失敗の残骸) | `/tmp`(boot disk) | **対応済み**(D114、削除・復旧完了) |
| 2 | `TMPDIR`未設定 | `extract_z8plus.py`/`build_global_overview.py` | 未対応 |
| 3 | `run_command()`が終了コードを見ていない(変換失敗後も無条件delete) | `utils.py`(`source_to_cog.py`等から呼ばれる) | 未対応 |
| 4 | `merged-3857.tiff`が非原子的書き込み(D48のresumeロジックが部分書き込みを完了と誤認しうる) | `aggregation_merge.py` | 未対応(D116のboundary_tileバグとは別件) |
| 5 | 最新世代のみを基準に削除する危険な設計 | `remove_dangling_pmtiles.py` | 未対応 |
| 6 | `.done`マーカーがdatatypeでスコープされておらず、1.5号のlineageパスが無視される | (`.done`マーカー全般) | 未対応、**D119のP2.B設計(`write_done_manifest()`の`datatype`フィールド)が同じ機構を直すため、実装時に一括対応可能** |

**残り10件は復元不可能**。P0(#1のみ)は当夜のうちに緊急対応、それ以外(#2-6を含む)は全て未着手のまま。

### Opusによる修正順序計画(フェーズ見出しのみ復元、詳細は不可)

| フェーズ | 内容(見出しのみ復元) | 状態 |
|---|---|---|
| Phase 0 | 当夜の作業継続(対馬・五島修復、西日本欠損修復等) | **完了**(D115-D118) |
| Phase 1 | 即座の危険物処理: `publish_cycle.py`本格修正、TMPDIRラッパー、`remove_dangling_pmtiles.py`安全化 | 一部対応(`publish_cycle.py`は安全装置のみ、本格修正は未着手) |
| Phase 2 | 複数日運用への耐性強化(`run_command`終了コードチェック等)、**1.5号前に必須と明記** | 未着手 |
| Phase 3 | (B)の本格修正(boundary_tileバグ)、1.5号のクリティカルパス | **完了**(D116) |
| Phase 4 | 1.5号ローンチ | 未着手 |

**H1〜H6(Hidenoriさんの判断が必要な項目として分離されていたもの)の内容は復元不可能**。件名・番号のみD115に残っていたが、各項目の具体的な内容は失われている。

### 今後の扱い

Fable項目#2-6・Opus Phase 1/2の残作業は、内容が具体的に分かっている分については通常のバックログとして扱い、`rustling-napping-pond.md`(1.5号準備計画)側にも該当する形で反映済みのものは反映した(D119発の項目は同計画に2026-09-03付けで追記済み)。Fable項目#2(TMPDIR)・#3(run_command終了コード)・#5(remove_dangling_pmtiles.py)は、Phase 2が「1.5号前に必須」と明記していた通り、1.5号のセクションD(launch前レビュー体制)着手前に改めて優先度を検討すること。H1〜H6は再現不可能なので、新たに同種の判断が必要になった際はゼロから洗い出す。

### Resume prompt

> D120で、D115が「セッションログ参照」として持ち越していたFableコードレビュー・Opus修正計画を、これ以上復元不可能という前提で最終整理・一本化した。Fable16件中6件のみ内容判明(1件対応済み、5件未対応)、Opus 5フェーズは見出しのみ判明(Phase 0・3完了、Phase 1一部・2・4未着手)。H1-H6は完全に復元不可能。**次のアクション**: Fable項目#2-6・Opus Phase 1/2の残作業を、1.5号着手前の優先度検討リストとして扱う(1.5号のセクションD着手前に再確認)。


## D121: P1.C(開放海域z16充填)のゲーティング実験完了(Fable) — 却下、沿岸部充填(P1.B)のみ採用

**Status**: Recorded, 2026-09-03 21:50 JST頃。D119のOpus設計が要求していたゲーティング実験(開放海域child_z=12タイルの定数値比率測定)をFableに委任、結果が出た。

### 結論

**定数値比率 f = 78.71%(78,705/99,989)、D119が設定した閾値(約95%)を下回る。開放海域のz16充填は実施しない。**

### 実験内容

- **全数調査**(サンプリングではない): 対象アイテム2,240件全て(`aggregation-store/01M0MWK852631SHCHPA66F21WQ/*-12-aggregation.csv`から取得、全てjpnationalseaのみが唯一のソース)、z6〜z12の99,989タイル全数を`/Volumes/pmtiles-store`上の実アーカイブから検証(欠損・重複・読み取りエラー0件)。
- 効率化のため、同一blobの重複除去(21,778個のユニークblobのみ実デコード、run_length加重で全体に反映)を実施、約3分で完了。
- 「定数値」の定義: 全チャンネル(RGB/RGBA)が全ピクセルでbit完全一致。

### 内訳(非定数値タイル21,284件、21.29%の性質)

単純な「ほぼ平坦」ではなく、明確に二峰性:
- 2,303件(非定数値の10.8%): 標高は単一値(0m)だがalphaチャンネルのみ変動——正規化すれば定数値化できるが、現状では重複除去を妨げている
- 186件(0.9%): 0.5〜10mの緩やかな起伏
- **18,795件(非定数値の88.3%、全体の18.8%)は10m以上の本物の起伏**——標高範囲の62%が100〜1000m、中央値43m・90パーセンタイル150m、最大1,736m。これらは「GSIデータなし」の海域カバレッジ内にある離島(北緯20-24度、東経122度付近、与那国・八重山周辺など)の実地形で、Copernicusデータが本物の陸地起伏を含んでいる。

つまり、開放海域充填を実施した場合、コストの大半は「誰も見ないz15/z16の海洋部詳細」にではなく、**約1.9万件の本物の地形起伏タイル**(z13〜z16の各段で1.4倍のコストがかかる)に費やされることになり、D119の判断基準(f>95%なら実施)に照らして正当化できない。

### 決定

D119のP1.C(開放海域充填)は**却下**。**P1.B(沿岸部・陸地のみのz16充填、+2.6GiB、+0.8%)のみを採用候補として残す**——これは今回の測定結果に影響されない、独立した判断のまま。alpha正規化(2,303件を定数値化)しても比率は81.0%止まりで、結論は変わらない。

### 現在の状態

`rustling-napping-pond.md`(1.5号準備計画)のP1.C該当箇所を「却下」に更新する。P1.Bは引き続きHidenoriさんの判断待ち(1.5号スコープに含めるか)。

### Resume prompt

> D121でP1.C(開放海域z16充填)のゲーティング実験が完了、定数値比率78.71%(閾値95%未満)により却下。開放海域の非定数値タイルの9割弱は離島の本物の地形起伏であり、充填のコストに見合わない。P1.B(沿岸部充填、+0.8%)のみが1.5号のスコープ候補として残る。**次のアクション**: `rustling-napping-pond.md`のP1.C記述を更新、P1.Bの1.5号スコープ採否をHidenoriさんに確認。


## D122: 1号再構築版の公開完了。西日本z13+・対馬五島z8-11の欠損、ライブサイトで解消確認

**Status**: Recorded, 2026-09-04 02:55 JST頃。D118で検証済みの再構築アーカイブ(313.9GB)をstarsへ公開し、ライブサイトでの動作確認まで完了した。

### 公開手順

1. **旧ファイル削除**(承認済み、220.65GB): starsのディスク空き容量(237GB)が新アーカイブ(313.9GB)を単純に追加コピーするには不足していたため、先に旧ファイルを削除してから転送する方式を承認を得て実施。この間、ライブサイトはダウンした。
2. **転送経路**: 当初`ssh stars.local`で直接到達を試みたが失敗(aaltoからは`.local`名前解決不可、`spacex.optgeo.org`というCloudflareトンネル経由でのみ到達可能と判明)。slateとstarsは実は同一LAN上にあることが判明したため(ping 22-38ms、`192.168.11.0/24`)、SSHエージェント転送(`ssh -A`)でaaltoの鍵をslate経由でstarsへ委譲し、LAN直接rsyncを実施。
3. **回線速度の制約**: stars(Raspberry Pi 4)の`eth0`が**100Mbps**で固定されており(本来ギガビット対応のはずだが、ケーブルまたはスイッチポート起因とみられる、未解決の物理的課題として残る)、暗号化の有無に関わらず約11.19MB/s(≈90Mbps)で頭打ち。313.9GBの転送に約7時間48分を要した(19:32開始→02:50代?付近。ステータス確認)。
4. **rsyncのメモリ問題と対処**: 初回試行時、以前中断した転送の部分ファイルとの差分照合でslateのメモリが12GB近くまで膨張(15GB/16GB使用、空き65MB)——`--partial`resumeロジックのオーバーヘッドと判明。部分ファイルを削除し`--whole-file`(チェックサム計算をスキップ)で再実行、メモリ使用量が12GB→97MBに改善、安定して完走。
5. **検証**: 転送完了後、stars側でも`pmtiles verify`をクリーン確認(3秒、slateの280msより遅いがRPiとして妥当)。アトミックリネーム(`.new`→本番名)、martin再起動(`systemctl --user restart martin`)。

### ライブサイト動作確認

公開URL(`https://stars.optgeo.org/mapterhorn-japan-bridge/...`)経由で、これまで欠損していた座標を直接確認:

| 座標 | 結果 | バイト数 |
|---|---|---|
| z13/6894/3521(与那国、西日本z13+欠損) | HTTP 200 | 64,276 |
| z13/7069/3337(桜島、西日本z13+欠損) | HTTP 200 | 367,980 |
| z8/219/101(対馬・五島欠損) | HTTP 200 | 225,036 |
| z11/1759/816(対馬・五島欠損) | HTTP 200 | 297,532 |

いずれもFableのローカル検証(D118)時のバイト数と完全一致——ライブサイトが検証済みアーカイブと寸分違わず一致していることを確認。TileJSONも`maxzoom:16`/`minzoom:0`で正しく応答。

### 現在の状態・次の一手

**1号の公開作業は完了**。D117で発見された西日本z13+の丸ごと欠落、D115/D116で修復した対馬・五島z8-11欠損、境界ブラーバグ(B)、いずれもライブサイトで解消された。

残課題(1.5号スコープへ持ち越し、`rustling-napping-pond.md`に反映済み): stale overview 949件、maxzoom宣言の精度(P1.B沿岸部充填、P1.C開放海域充填はD121で却下)、`get_pmtiles_folder`のz<7ギャップ、overview鮮度マニフェスト、generation_id名前空間分離。stars側の100Mbps回線速度上限も、今後の大容量アーカイブ入れ替えのたびにボトルネックになるため、中長期的にケーブル/スイッチポートの物理確認を検討する価値がある。

### Resume prompt

> D122で1号再構築版アーカイブ(313.9GB)の公開が完了。西日本z13+・対馬五島z8-11の両方の欠損がライブサイトで解消されたことを、公開URL経由の直接確認(4座標、Fableのローカル検証と完全一致するバイト数)で確認済み。stars側の100Mbps回線速度上限(RPi 4、原因未特定)により転送に約7時間48分を要した——今後の大容量転送のたびにボトルネックになるため、物理的な確認(ケーブル/スイッチポート)を中期的に検討する価値がある。**次のアクション**: 1号の公開作業はこれで一区切り。残課題は全て1.5号スコープ(`rustling-napping-pond.md`に反映済み)へ持ち越し。次はHidenoriさんの指示を待つ(1.5号着手のタイミング、または他の優先事項)。


## D123: 【重要】1.4号アレンジで全国再生成を起動しかけたが、D76型衝突バグをFableが発見・寸前で回避。1.5号アレンジへ方針転換

**Status**: Recorded, 2026-09-04 06:35 JST頃。D116の(B)修正(boundary_tile erosion-gateバグ)は既存の1号データにまだ適用されていない(コードのみ修正、既存6,373件のaggregationは未再生成)ことを受け、Hidenoriさんの決断で「壁の完全解消のため全国aggregation再生成を行う」ことが確定した。この再生成をどの枠組みで行うかで重大な発見があった。

### 経緯: 1.4号という呼称の導入

D122(1号公開完了)後、ライブサイトで確認された残存する「壁」について議論し、**新しいgeneration_idも新しい名前空間構造も使わず、同じ1号データにD116修正済みコードを再適用するだけ**の作業を「1.4号」と呼ぶことで合意(1.5号が担う構造的変更=D95/D107名前空間分離+lineage機能+ファイル名リファクタリングとは明確に切り離す方針)。

### 1.4号 launch前最終チェックで発見した問題

- `get_pmtiles_folder()`のz&lt;7ギャップ(P2.A)は未修正のまま(1.4号では影響軽微と判断、様子見)
- `aggregation_run.py`にTMPDIR未設定を発見・修正(D104/D105と同型、全国規模での孤立ファイル蓄積リスク)
- 未コミットの`downsampling_covering.py`(min_output_zoom=8、8/30のHidenoriさんの設計、今夜も実際に使用)をコミット
- **bundle-store内の重複ファイル発見・削除**: 既にstarsへ転送・検証済み(D122)の313.9GBファイルがslate上にも残っており、誘爆リスクとして削除(stars側の独立コピーを確認してから実施)
- **検算の徹底**(Hidenoriさんの指示): aggregation roster(6,373件)を複数角度から検証——(1)総CSV数・`.todo`化数・孤児(マーカーなし)・不整合(両マーカー)が完全一致、(2)z-x-y座標の重複ゼロ(名簿はzoom階層を持たない、地理座標ごとに1件のフラット構造と確認)、(3)**source-store全体との突き合わせ**: jpnational1(291,779件)・jpnational5(422,119件)・jpnational10(4,981件)・jpnationalsea(275件)、全て「オンディスクだが未参照」0件・「参照されているが実在しない」0件——完全一致。この最後の検証が、対馬・五島パターン(名簿に載っているのに実体がない/実体があるのに名簿にない)の事前予防チェックとして機能した。
- 全6,373件の`.done`→`.todo`変換を実施(バックアップマニフェストを`meta-store/d123_done_manifest_backup.json`に保存した上で)、起動準備完了の状態にした。

### 重大発見: Fableによる1.4号 vs 1.5号アレンジ比較で、D76型衝突バグが判明

起動直前、「1.4号と1.5号のどちらのアレンジで全国再生成を行うべきか、確度・トレードオフを洗い出してほしい」とFableへ委任した結果、**1.4号アレンジには実在する重大なバグがある**ことが判明した:

- **`aggregation_tile.py`のクリーンアップ用glob(`{out_folder}/{z}-{x}-{y}-*.pmtiles`削除)が、1.4号が使う旧フラット構造では、aggregation層とdownsampling層の座標が重複する場所(**D76の実測で6,373件中3,344件**)に対して、downsamplingの正規ファイルを誤って削除してしまう**。新レイヤー分離構造下ではこのフォルダはaggregation専用になり安全だが、1.4号はD115の「1.5号flight前に削除する」と明記された一時フォールバック経由で書き込むため、この安全性の前提が崩れる。**全国規模でD76事故をほぼそのまま再現しかねない状態だった**。
- 加えて、z&lt;7の新旧レイアウト分裂(P2.A)により、1.4号自身が生成するz&lt;7のdownsampling出力が`bundle_1go_rebuild.py`の旧レイアウトglobから見えなくなる問題も併発する。
- **コスト面でも1.4号は見た目ほど安くない**: 50-70時間の全国再生成を今1.4号で払っても、1.5号自身の検証(特にlineage機能——reprojectの中間ファイルを消費する構造上、1.4号のデータを再利用できない)にはどのみち**別途フルの全国ランが必要**になり、実質的に二重払いになる。1.5号アレンジなら一度で(修正+名前空間分離+lineage+ファイル名整理)全て検証できる。

### 決断: 1.4号を中止、6,373件の`.done`を安全に復元、1.5号アレンジへ全面転換

Fableの報告を受け、**起動前に**以下を実施:
1. 先ほどの`.done`→`.todo`変換を**即座に完全ロールバック**(6,373件を`.todo`→`.done`に戻す、検証済み——1号データは一切変更されておらず無傷)。
2. Hidenoriさんへ状況を報告、「1時間以内にlaunch」という当初目標は、1.4号の危険性が判明した後では安全性を犠牲にする選択になるため、**Hidenoriさんの判断で撤回**。「70時間の失敗を、10時間の有効活用確保のために誘致してはならない」との明確な方針決定。
3. **今後10時間(Hidenoriさん不在中)は、1.5号の前提条件整備とウェットドレスリハーサルの完走に充てる**。全国規模の実際の起動(50-70時間)は、Hidenoriさんの帰還後、最終確認を経てから行う——今夜これ以上先送りしない、最も後戻りしにくい一手として、意図的に人間の最終承認ポイントとして残す。

Fableへ、以下5条件の実装+チェーン化リハーサル完走を委任(継続中):
1. `.done`マーカーのdatatypeスコープ修正(D119のP2.B設計、lineageブロッカーの解消と兼ねる)
2. `pmtiles-store`パスへのgeneration_id階層追加(1.5号↔2号の将来的衝突予防)
3. 新レイヤー構造下での`aggregation_tile.py`クリーンアップglobの安全性を実地確認
4. 新generation_id発行、PLAN.mdの対応表更新
5. Phase 2堅牢化3点(`run_command`終了コードチェック、TMPDIRラッパー自動化、`remove_dangling_pmtiles.py`安全化)

その後、隣接する2件以上のaggregationアイテムで、aggregation(lineage込み)→downsampling(elevation・lineage両方)→bundle→mergeのフルパイプラインを`pipelines-rehearsal/`環境で実地検証(D110が「チェーン化されていない」という制約を残していた点を今回解消)。**全国規模の実際のlaunchは一切行わない**、と明示的に指示済み。

### 検算の着眼点(今後の知識として、cafebabeへの共有候補)

今回徹底した検算パターンは汎用性が高く、記録に値する:
- 母集団の理論値との一致確認(内部一貫性だけでなく、外部の独立した参照点との突き合わせ)
- 孤児(参照されているが実体がない)と未参照(実体はあるが参照されていない)の両方向チェック
- 名簿がzoom階層を持つ場合は親子関係の再確認、持たない場合は地理的完全性(前段データとの全数突き合わせ)へ軸を切り替える判断
- 「これは対馬・五島パターン(部分的な参照断絶)の再来を防ぐ具体的なチェックか」という視点での逆算

### Resume prompt

> D123で、1.4号アレンジ(全国aggregation再生成を1号の既存generation_idにそのまま適用)がD76型の衝突バグ(aggregation_tile.pyのクリーンアップglobが、旧フラット構造下でdownsampling正規ファイル最大3,344件を誤削除しうる)を持つことをFableが launch直前に発見。起動準備(6,373件の`.done`→`.todo`変換)は即座に完全ロールバックし、1号データは無傷。**1.5号アレンジ(新generation_id、名前空間分離+lineage+ファイル名整理を一度に検証)へ全面転換**。Hidenoriさん不在の10時間で、Fableに前提条件整備(datatypeスコープ・generation_id階層・堅牢化3点)とチェーン化リハーサルの完走を委任、**全国規模の実際のlaunchはHidenoriさんの帰還後の最終承認まで意図的に保留**。**次のアクション**: Fableの実装+リハーサル結果を確認、Hidenoriさんの帰還を待って全国launchの可否を最終確認する。


## D124: 1.5号 pre-launch hardening implemented and proven by chained rehearsal -- generation_id store layer, .done manifests (datatype + inputs fingerprint), D120 Phase-2 trio. National launch NOT started, awaiting Hidenori's explicit go

**Status**: Recorded, 2026-09-04. Hidenori's instruction: take the safe
(「1.5号 arrangement」) path, spend up to ~10 unattended hours preparing
and rehearsing so that on his return the ONLY remaining step is his own
final approval to launch the 50-70h national run. All five conditions
from the prior comparison report are implemented in production
`pipelines/` code and proven end to end in an isolated
`pipelines-rehearsal/` environment. **The national run was deliberately
not started.**

### 1. `.done` manifests (D119 P2.B + D120 Fable #6) -- the lineage hard blocker and the overview-freshness hole, closed by one mechanism

`.done` markers are no longer empty touch files. `utils.py` gained a
manifest layer (`write_done_manifest()` / `read_done_manifest()` /
`done_covers()` / `done_is_current()` / `downsampling_done_path()` /
`stat_input_entry()` / `content_input_entry()`), format
`mjb-done-manifest/1`: JSON carrying `datatypes` (which datatype(s) the
marker certifies), `generation_id`, per-input entries (covering CSVs by
content sha256 -- deliberately NOT mtime, coverings are rewritten
byte-identical every publish cycle; child PMTiles by size+mtime_ns; a
missing child recorded as an explicit `missing` entry), and an overall
`inputs_fingerprint`.

- `aggregation_run.py`: skip check is now `done_covers(done_path,
  ['elevation','lineage'] if EMIT_LINEAGE else ['elevation'])` -- an
  elevation-only marker no longer silently satisfies an EMIT_LINEAGE
  run (previously a lineage pass over an aggregated generation would
  have been a national-scale no-op). Completion writes the manifest
  atomically; `.todo` removal is now best-effort (D110's rehearsal
  tripped on the old hard rename).
- `downsampling_run.py`: elevation keeps the historical
  `-downsampling.done` name; lineage gets its own
  `-downsampling.lineage.done` (deliberately does NOT match the legacy
  `*-downsampling.done` audit globs, keeping old tooling
  elevation-only). The skip check is `done_is_current()`: datatype
  coverage AND inputs-fingerprint freshness -- a repaired/replaced
  child now automatically invalidates every overview above it. This is
  the structural fix for D119's 949/8,223 (11.5%) stale overviews.
  Pre-run entries are recorded (not post-run), so a child changing
  mid-run correctly reads as stale next pass. Legacy empty markers
  (all of 1号) parse as elevation-only/freshness-unknown and are never
  churned.
- Consequence to be aware of: running `EMIT_LINEAGE=1` against a
  generation whose items have elevation-only manifests rebuilds those
  items entirely (elevation included). Intended, but worth knowing
  before pointing it at 1号.

### 2. `generation_id` directory level -- the D74-D76-class 1.5号/2号 collision, structurally closed

`utils.get_pmtiles_folder()` now REQUIRES `generation_id` (no default;
a missed call site fails loudly as TypeError/ValueError instead of
silently sharing a path -- partial application was D74-D76's failure
mode). Layout: `pmtiles-store/{layer}/{datatype}/{generation_id}/
{z7bucket}/`. The D115 legacy-flat fallback is now hard-gated to
`FLAT_LEGACY_GENERATION_ID = '01M0MWK852631SHCHPA66F21WQ'` (1号): only
1号-addressed calls can ever resolve to the old flat tree, so a
1.5号/2号/rehearsal write or cleanup glob can never land in 1号's live
data. This also closes the independently-found A1 hazard (an Opus
pre-launch checklist, verified by execution 2026-09-04): before this
change, ALL four (layer, datatype) combos collapsed into the same 1号
flat directory for every z>=7 bucket whose layered dir didn't exist
yet -- i.e. a fresh 1.5号 write would have landed inside 1号's flat
store and aggregation_tile.py's stale-cleanup glob would then have
deleted 1号 production files at that position. Verified closed by
execution: all 8 (generation, layer, datatype) combos at a position
where 1号's flat bucket exists resolve to 8 distinct generation-scoped
paths; bare calls are refused.

Every call site updated and audited twice (straight read + a
multiline-aware re-grep of every `get_pmtiles_folder(` call):
`aggregation_tile.py`, `lineage_tile.py` (new `aggregation_id` param,
threaded from `aggregation_run.emit_lineage()`), `downsampling_run.py`
(x3 -- the third, inside worker-process `create_tile()`, was initially
missed and caught by the re-grep pass, validating D95's warning),
`check_downsampling_done_integrity.py` (+`--datatype` flag),
`check_downsampling_readiness.py` (+`DOWNSAMPLING_DATATYPE` env),
`check_aggregation_dirty_gap.py` and `check_covering_gaps.py` (both
predated D95's required `layer` arg and would have raised TypeError if
run -- fixed), `mjbmon_snapshot.py`, and `bundle.py`'s glob patterns
(now `.../{datatype}/{generation_id}/...`; generation defaults to the
latest aggregation-store id, `BUNDLE_GENERATION` overrides, printed in
the first log lines). 1号-era flat tools (`bundle_1go_rebuild.py`,
`create_index.py`, `check_stale_duplicates_v2.py`) deliberately
untouched.

### 3. aggregation_tile.py cleanup-glob collision: verified inert, not re-asserted

The stale-cleanup glob (`{out_folder}/{z}-{x}-{y}-*.pmtiles`, also in
`lineage_tile.py`) was traced under the new layout: `out_folder` is now
layer-, datatype-, AND generation-scoped, and the legacy-flat fallback
is unreachable for any non-1号 generation, so the glob can only ever
match this generation's own prior output at this exact position.
Confirmed empirically: after the full rehearsal, 1号's flat bucket at
the rehearsal position (`pmtiles-store/7-116-46/`, 267 files) has an
identical `ls -la` md5 to its pre-rehearsal baseline, and the
production layered tree contains 0 files.

### 4. 1.5号 generation_id minted and recorded

`01M1MKD73P0KDT719H21NJV9VR`, minted via the same `ULID()` mechanism
`aggregation_covering.py` uses, recorded in PLAN.md section 0's
existing table (checked first -- the 1.5号 row was a placeholder, no
duplicate created). `aggregation_covering.py` gained an
`AGGREGATION_ID` env override so the launch run uses exactly this
pre-recorded id: `AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR uv run
python3 aggregation_covering.py`. The aggregation-store directory is
deliberately NOT pre-created (it would become get_aggregation_ids()'s
"latest" and confuse every latest-generation tool before launch).

### 5. D120 Phase-2 trio (「1.5号前に必須」)

- **`utils.run_command()` (Fable #3)**: now raises RuntimeError on
  nonzero exit (default `check=True`, stderr tail included). One call
  site fixed to survive this: `downsampling_covering.py`'s
  `rm *-downsampling.csv` (exits 1 on a fresh generation's empty glob)
  became an in-process glob+remove. All other call sites audited --
  the source_*.py mv/convert/rm chains are exactly the "unconditional
  delete after failed conversion" hazard this fixes.
- **TMPDIR (Fable #2)**: new `pipelines/pmtiles` shell wrapper
  force-points TMPDIR at `<script-dir>/pmtiles-store/tmp-store/
  go-cli-scratch` and execs the real Go CLI -- manual invocations
  become `./pmtiles merge ...`, no per-screen-session `export TMPDIR`
  to remember (which bit the 2026-09-03 session repeatedly). Resolves
  relative to its own location, so the rehearsal env's scratch lands in
  the rehearsal store. Also added the force-override header (same block
  as bundle.py) to `extract_z8plus.py` and `build_global_overview.py`,
  the two scripts Fable #2 named.
- **`remove_dangling_pmtiles.py` (Fable #5)**: rewritten. Was:
  latest-generation-only baseline vs a SHARED flat store, immediate
  deletion -- structurally the D74-D76 accident. Now: operates on
  exactly one explicitly-named generation_id, scans ONLY that
  generation's own subtrees (other generations structurally out of
  reach), REFUSES 1号 outright (flat layout, no safe automated
  reasoning), and dry-runs by default (`--delete` required). All four
  behaviors smoke-tested (clean env: 0 dangling; 1号: refused; planted
  orphan: survives dry run, removed by `--delete`).

### Chained rehearsal (closing D110's gap: that rehearsal was single-item, unchained)

Isolated `pipelines-rehearsal/` recreated (the old one was deleted for
disk space): production `*.py` via symlinks (the real code under test),
own `aggregation-store`/`bundle-store`/`meta-store`, own
`pmtiles-store` -> `/Volumes/pmtiles-store/rehearsal-1p5-store`,
shared read-only `source-store`. `uv run --no-sync --project
../pipelines` reuses the production venv (a fresh venv fails: no
imagecodecs cp314 wheel). Disposable generation
`00TESTREHEARSAL15GOCHAINED1`; items `10-930-369-13` +
`10-931-368-13` -- diagonal SIBLINGS under z9 parent `9-465-184`
(Etorofu), chosen so downsampling genuinely combines two archives.

Full chain, all real code, both datatypes:
`EMIT_LINEAGE=1 aggregation_run.py` -> `downsampling_covering.py` ->
`downsampling_run.py` (elevation, STRICT) -> (lineage, STRICT) ->
`bundle.py` x2 -> `merge_japan_bundles.py` x2 -> `./pmtiles verify` x2.
All exit 0, no warnings. Measured results:

- **Locations**: all 20 archives exactly at `pmtiles-store/{layer}/
  {datatype}/00TESTREHEARSAL15GOCHAINED1/7-116-46/`; production
  layered tree 0 files before AND after; 1号 flat bucket md5-identical
  to baseline; no writes anywhere in production.
- **Chaining**: `9-465-184-9-downsampling.csv` references BOTH sibling
  archives; the merged z9 tile has exactly the two diagonal quadrants
  valid (65,536 px each), NE from `10-931-368`, SW from `10-930-369`.
- **Elevation**: rehearsal z13 leaves byte-identical to 1号's
  production archives at the same positions (3/3 sampled); chained z9
  tile range [0, 1576.4] m, mean 117.7 m -- consistent with Etorofu
  (Chirippu-dake ~1560 m).
- **Lineage**: leaves 100% tier 6 (sea) on ocean tiles; chained z9
  majority-vote tile 49.9% tier 5 (DEM10B land) / 50.1% tier 6 (sea).
  Merged `mapterhorn-japan-bridge-lineage.pmtiles` 172 tiles, verify
  clean, z8 top tile present.
- **Manifests**: every marker carries the datatype-scoped,
  fingerprinted format (sample recorded in the .done files themselves).
- **Freshness, live**: `touch` on one leaf archive -> re-run rebuilt
  exactly that leaf's chain (z12->z11->z10->z9->z8, each logging
  "done marker exists but inputs changed -- rebuilding stale overview
  (D119)") while the untouched sibling's items stayed done. Second
  clean re-run: 8/8 "already done (and inputs unchanged)".
- **172 tiles** per datatype = 128 z13 + 32 z12 + 8 z11 + 2 z10 +
  1 z9 + 1 z8, both datatypes equal -- internally consistent.

### Open questions for Hidenori (launch gate -- none of these are code blockers)

1. **Push**: changes are committed locally on slate
   (`hfu/mapterhorn` and this repo) but NOT pushed -- push when you've
   reviewed, or say the word.
2. **Disk plan**: `/Volumes/pmtiles-store` has ~994Gi free; 1.5号's
   layered store will be roughly 1号-sized (~580GB) + lineage (5-15%).
   Fits, but decide whether 1号's flat store (~579GB) stays through
   the whole run. `Migrate-2025-04` (bundle-store side) has ~675Gi.
3. **EMIT_LINEAGE semantics on 1号**: see section 1's consequence note.
4. **z<7 gap (D119)**: unchanged for 1号 (67 z6 flat files still
   invisible to layered tools); 1.5号 stops at z8 (min_output_zoom=8),
   so no z<7 files will ever exist for it -- moot for launch, revisit
   only if a sub-z8 product is ever wanted.
5. **`publish_cycle.py`**: still hard-guarded off (D115) -- 1.5号
   publish remains manual, per the D109 runbook, now via `./pmtiles`.
6. **Rehearsal cleanup**: `pipelines-rehearsal/` (+ its ~20MB store at
   `/Volumes/pmtiles-store/rehearsal-1p5-store`) kept for your
   inspection; delete or reuse for the next rehearsal as you prefer.

### Launch runbook (after explicit go)

```
cd ~/github/hfu-mapterhorn/pipelines
AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR uv run python3 aggregation_covering.py
EMIT_LINEAGE=1 uv run python3 aggregation_run.py            # ~50-70h national
uv run python3 downsampling_covering.py
DOWNSAMPLING_STRICT=1 PRIORITY_MODE=quadrans uv run python3 downsampling_run.py
DOWNSAMPLING_DATATYPE=lineage DOWNSAMPLING_STRICT=1 PRIORITY_MODE=quadrans uv run python3 downsampling_run.py
uv run python3 bundle.py 1                                   # elevation
BUNDLE_DATATYPE=lineage uv run python3 bundle.py 1
uv run python3 merge_japan_bundles.py                        # -> .z8plus
MERGE_DATATYPE=lineage uv run python3 merge_japan_bundles.py # -> -lineage (final)
./pmtiles merge bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles \
    /Volumes/Migrate-2025-04/global-overview-backup.pmtiles \
    bundle-store/mapterhorn-japan-bridge.pmtiles             # overview splice, via wrapper
./pmtiles verify bundle-store/mapterhorn-japan-bridge.pmtiles
./pmtiles verify bundle-store/mapterhorn-japan-bridge-lineage.pmtiles
```

### Resume prompt

> D124: 1.5号の準備・リハーサル完了、launch待ち。5条件すべて実装済み
> (.doneマニフェスト=D119 P2.B、generation_id階層+全呼び出し箇所監査、
> cleanup-glob安全性の実証、1.5号ID=`01M1MKD73P0KDT719H21NJV9VR`を
> PLAN.md §0に記録、D120 Phase-2三点セット)。隣接兄弟2アイテムでの
> chained rehearsal が全工程 (aggregation EMIT_LINEAGE=1 ->
> downsampling両datatype -> bundle -> merge -> verify) 完走、elevation
> は1号とバイト一致、lineage多数決・鮮度無効化も実測で確認、本番への
> 書き込みゼロをmd5で確認。**全国launchは未実行**——上の runbook を、
> D124のopen questions (push可否、ディスク計画) に答えてから、明示的な
> goで実行すること。slateローカルにコミット済み・未push。



## D125: 独立採点(Opus)完了 — D124実装は「push可」、国全体launch前に4点の小修正を実施。ランブック確定

**Status**: Recorded, 2026-09-04 07:10 JST頃。D124(1.5号 pre-launch hardening)の実装を、実装者(Fable)とは別のOpusインスタンスが、事前に独立導出したチェックリスト(A〜M節)に照らして採点した。自己申告を鵜呑みにせず、実際のdiff読解+実行検証で確認する方式。

### 採点結果サマリー

**総合判定: 「pushして良い、正味で大きな安全性向上、後退は皆無」**。特筆すべき点:

- **A1(D115フォールバック衝突)は実行検証込みで解消確認**: `generation_id`が必須引数となり、1号のULIDにのみフォールバックが限定されることを、実際にコードを実行して確認(4つの(layer,datatype)組み合わせが1.5号では4つの別ディレクトリに、1号は従来通り1つの共有ディレクトリに、という挙動を実測)。加えて、本番レイヤー構造ツリーに9/4付けの新規ファイルが皆無であることも確認、リハーサルが1号に一切触れていないことを独立に裏付けた。
- **`.done`マニフェストの鮮度判定ロジックは、こちらが要求した以上の設計**: 「欠損中の子タイル」を明示的な`missing`エントリとして記録する仕組み・実行前(実行後ではなく)のフィンガープリント記録という2点は、採点者が事前に想定していなかった改善だった。
- **`remove_dangling_pmtiles.py`は「最も危険なファイル」から「最も安全なファイル」に転換**——generation_id明示指定必須、1号を明示的に拒否、dry-run既定。
- リハーサルの「対角線上の兄弟タイル」という選択は、採点者が指定した「隣接タイル」より優れたテスト設計(結合後のズレが視覚的に一目瞭然になる)と評価された。

### 発見された残課題(4点、全て小規模)

1. **【唯一のBLOCKER級、ただし緊急性は中程度】F1: `downsampling_run.py`にTMPDIR設定が皆無**。実装者が用意した`./pmtiles`ラッパーはGo CLI経由の呼び出しのみをカバーしており、PythonのWriter経由(`utils.create_archive()`)は別の脆弱経路として見落とされていた。全国規模では8,223件×2データ種別のアーカイブ書き込みが発生し、起動ディスクへのスクラッチ蓄積(D115の310GB破損事故と同じ機構)のリスクがある。**→ 即座に修正済み**(`aggregation_run.py`と同じパターンでTMPDIR強制設定を追加)。
2. **J1: テスト用generation 3件(`00TEST0000WALLgoto`/`tsushima`/`tsushimabay`)が本番`aggregation-store/`に残存**——`[-1]`は汚染しないが`[-2]`をずらし、全ての`get_aggregation_ids()`消費者に影響しうる。**→ 削除済み**。
3. **J2: `aggregation_merge.py.D113FIX`(D116修正前の下書き)が未追跡のまま残存**——誤って`cp`するとD116の境界ブラー修正が巻き戻る危険な残骸。**→ 削除済み**。
4. **ランブック項目の明文化不足**(D4/K4/L5/F4、いずれもコードの問題ではなく手順書の不足):
   - `meta-store/bundle/*.json`が1号の日付・サイズのまま残存(1.5号のbundleが完全なら自己修復するが、部分実行時に紛らわしいサイズ不一致エラーを出す)——**bundleステージ直前に`rm meta-store/bundle/*.json`を実行する手順として明記**
   - D123の名簿突き合わせ検算(母集団理論値・孤児チェック・source-store全体との突き合わせ)を、1.5号の`aggregation_covering.py`実行後・`aggregation_run.py`実行前に**必ず再実行する手順として明記**(対馬・五島パターンを1日目で捕まえるための最も安価な保険)
   - ロールバックコマンドを実行時にその場で考えるのではなく、事前に文書化: `rm -rf pmtiles-store/{aggregation,downsampling}/*/01M1MKD7*/ aggregation-store/01M1MKD7*/`
   - `pmtiles cluster`ステップがランブックに含まれていない点(D118の1号復旧では実施していた)——今回省略されているのが意図的か見落としかを明確化する必要がある。**→ 未解決、Hidenoriさんの確認事項として残す**(cluster化しない場合の実害は軽微だが、70時間後に気づくと高くつくため事前に判断すべき)。

### 副次的にCANNOT VERIFYとされた項目(要対応、軽量)

- E5: `lineage_downsample.py`の自己テスト(D94、4パターン)が1.5号の変更後に再実行された形跡がない。`uv run python3 test_lineage_downsampling.py`を実行するだけ(数十秒)。
- G1: ディスク容量の逐条計算が文章化されていない(994GB空き vs 1.5号の想定サイズ640-670GB、1号の869GBフラットストアを維持する場合はより厳しい)。Hidenoriさんの判断事項として引き続き保留(1号のディスク保持方針次第で数字が変わるため)。

### 現在の状態

D124の4コミット(hfu-mapterhorn: `7badda7`・`56d3cec`、mapterhorn-japan-bridge: `36cc87b`・`a602cab`・`c72aff3`)は全てpush済み。今回のF1/J1/J2修正は追ってコミット・push予定。国全体規模での実際のlaunchは**引き続き未実施、Hidenoriさんの帰還後の最終承認を待つ**。

### Resume prompt

> D125で、D124(1.5号 pre-launch hardening)の独立採点が完了。「push可、正味で大きな安全性向上」との判定。唯一のBLOCKER級指摘(F1: `downsampling_run.py`のTMPDIR未設定)を含む4点の残課題を発見、即座に対応(F1修正・J1/J2クリーンアップ完了、ランブック項目はD125に明記)。**次のアクション**: (1) F1/J1/J2の修正をコミット・push、(2) `pmtiles cluster`ステップの要否をHidenoriさんに確認、(3) `test_lineage_downsampling.py`再実行、(4) ディスク容量の逐条計算と1号フラットストア保持方針の確定、(5) 全て揃った上でHidenoriさんの帰還を待ち、全国規模launchの最終承認を得る。


## D126: ドキュメントstaleness監査(Opus)完了。START_HERE.md新設、CLAUDE.md/PIPELINE_DESIGN.mdの重大な古い記述を修正

**Status**: Recorded, 2026-09-04 07:25 JST頃。D124/D125の採点と並行して、別のOpusインスタンスへ「プロジェクト内の全`.md`ドキュメントが実装と乖離していないか」の監査を委任した。

### 発見された最重要級(P0、「新セッションを実際に誤誘導しうる」)staleness

- **`CLAUDE.md`が1.5号を「まだ着手すべきでない」と指示していた**——実際にはD107/D124で実装・リハーサル・採点まで完了済み。同様に`HANDOVER.md`の古いresume promptにも同型の古い指示が残存。
- **最終アーカイブのファイル名が3箇所で食い違っていた**(`CLAUDE.md`・`README.md`・`PIPELINE_DESIGN.md`)。D109以降、中間ファイルは`mapterhorn-japan-bridge.z8plus.pmtiles`、最終公開物のみが`mapterhorn-japan-bridge.pmtiles`を名乗るが、複数箇所が旧命名のまま。
- **`publish_cycle.py`がD115で完全に無効化(`sys.exit(1)`)されている事実が、それを操作手順として説明している複数ドキュメントのどこにも書かれていなかった**——読んだ人がそのまま実行しようとしうる、最も実害の大きい発見。
- **環境変数リファレンス表(`PIPELINE_DESIGN.md`§5)のTMPDIR行が完全に古く**、1.5号のlaunch runbookが依存する6変数(`AGGREGATION_ID`/`EMIT_LINEAGE`/`BUNDLE_DATATYPE`/`BUNDLE_GENERATION`/`DOWNSAMPLING_DATATYPE`/`MERGE_DATATYPE`)が表に一切載っていなかった。

### 対応

上記4点全て修正・commit・push済み(`e702900`)。加えて、cafebabeプロジェクト的な「まずこれを読め」文書として**`START_HERE.md`を新設**——プロジェクトの位置づけ・3リポジトリ+2ホストのトポロジー・1号/1.5号/2号の意味・「今夜起きた6つの本物のインシデントから逆算した不変条件」・現在状態への案内、をコンパクトにまとめ、各詳細は既存ドキュメントへポインタで委ねる設計。

### 未対応のまま残った指摘(P1/P2/P3、優先度は相対的に低い)

- `.done`マーカーの説明(§3.2/§3.7)が「空ファイル」のまま、D124後の実際のJSON manifest形式を反映していない
- `PIPELINE_DESIGN.md`のフロー図自体(§2)にファイル名の古さが残る
- `HANDOVER.md`に9/1時点の「Current state」セクションが9/4時点のものと並存し、矛盾する古い指示(publish保留・PRIORITY_MODEが死んだコードだという誤った記述)を含んだまま
- ワーカー数既定値が`PIPELINE_DESIGN.md`と`PLAN.md`で微妙に食い違う(コード既定値 vs 運用実績値の混同)
- `hfu-mapterhorn/FORK_NOTES.md`の「upstream比20コミット先行」が実際は94コミット

これらは次回セッションでの対応候補として残す(監査自体の全文は今回のセッションログに保存済み、再度の監査委任は不要)。

### Resume prompt

> D126でドキュメントstaleness監査(Opus)が完了、`START_HERE.md`新設+P0級の古い記述4点(1.5号着手指示・アーカイブ命名・publish_cycle.py無効化の未記載・環境変数表)を修正・push済み(`e702900`)。P1/P2/P3級の指摘(`.done`マーカー説明・HANDOVER.mdの新旧併存・ワーカー数食い違い・FORK_NOTES.mdの数字)は未対応のまま次回に持ち越し。**次のアクション**: 余裕があれば残りのstaleness項目を対応、なければ1.5号launchの最終判断を優先する。


## D127: 【重要】1.5号 全国規模launch承認・着手。ランブック最終確定(pmtiles cluster追加・headroom監視拡張)

**Status**: Recorded, 2026-09-04 07:20 JST頃。D124(実装)・D125(独立採点)・D126(ドキュメント監査)を経て、Hidenoriさんから明示的なlaunch承認を得た。「Lift off」。

### launch前最終確認(Hidenoriさんとの対話)

1. **`pmtiles cluster`のランブック追加を承認**。D118(1号復旧)の実績通り、`merge_japan_bundles.py`(z8plus中間ファイル生成)の直後・最終`pmtiles merge`(z0-7オーバービュー接合)の直前に位置づける。
2. **ダッシュボード(progress.json)の更新責任がエージェント(私)に依存することを了承**——完全自律更新ではなく、私の応答頻度に依存する限界を開示した上で、その運用を継続することで合意。
3. **`check_disk_headroom.py`を`pmtiles-store`もカバーするよう拡張してから進める**、という条件付きで承認。実装・動作確認・commit・push済み(`6b11542`)——15分ごとの既存screenループが次回実行時に自動的に新版を使う(再起動不要)。両ボリュームとも記録開始を確認(Migrate-2025-04残り1,038.5GB、pmtiles-store残り1,067.0GB)。

### 確定した1.5号ランブック(D124/D125からの更新)

```
1. AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR uv run python3 aggregation_covering.py
2. 【新規、D123パターンの名簿突き合わせ、K4】aggregation-store/{new_gen}/の
   総CSV数・.todo化数・孤児・不整合・座標重複ゼロ・source-store全体との
   双方向突き合わせを実行、対馬・五島パターンを最初期に検知する
3. AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR EMIT_LINEAGE=1 uv run python3 aggregation_run.py
   (screenセッション、TMPDIR自動設定済み)
4. 完了後: downsampling_covering.py → downsampling_run.py
   (DOWNSAMPLING_DATATYPE=elevation、続けてlineage)
5. bundle.py(BUNDLE_DATATYPE=elevation・lineage、BUNDLE_GENERATION明示)
6. merge_japan_bundles.py(MERGE_DATATYPE=elevation・lineage)
7. 【新規追加、今回確定】./pmtiles cluster (z8plus中間ファイル)
8. ./pmtiles verify
9. ./pmtiles merge (global-overview-backup.pmtilesとのz0-7接合)
10. ./pmtiles verify(最終)
11. meta-store/bundle/*.json を事前にクリア(D125のD4項目、bundleステージ直前)
12. ロールバックコマンド(必要時): rm -rf pmtiles-store/{aggregation,downsampling}/*/01M1MKD7*/ aggregation-store/01M1MKD7*/
13. Hidenoriさんの最終承認を得てからstarsへ手動rsync(publish_cycle.pyは使わない)
```

### 着手

上記ステップ1・2を実行し、着手を記録する。ステップ3(全国aggregation本体、EMIT_LINEAGE=1、50-70時間見込み)をscreenセッションで起動する。

### Resume prompt

> D127でHidenoriさんから1.5号(generation_id `01M1MKD73P0KDT719H21NJV9VR`)の全国規模launch承認を得て着手した。launch前の最終3条件(pmtiles clusterのランブック追加・ダッシュボード運用の了承・headroom監視のpmtiles-store拡張)は全て満たしてから実行。ランブックはD127に確定版を記録。**次のアクション**: aggregation_covering.py実行→名簿突き合わせ(K4)→aggregation_run.py(EMIT_LINEAGE=1)をscreenで起動、以降は定期的な進捗監視とダッシュボード更新を継続する。完了(50-70時間後)まで、downsampling→bundle→cluster→merge→publish承認、と続く。


## D128: 1.5号 全国aggregation本体、起動完了(07:23 JST)

**Status**: Recorded, 2026-09-04 07:24 JST。D127の承認を受け、実際に起動した。

### 実施内容

1. `AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR uv run python3 aggregation_covering.py` 実行、covering生成成功。
2. 名簿突き合わせ(D123/K4パターン)実行、**完全クリーン**: 総CSV数6,373件(1号と完全一致)、`.todo`化6,373件、孤児0・不整合0・座標重複0、source-store全体(jpnational1: 291,779件・jpnational5: 422,119件・jpnational10: 4,981件・jpnationalsea: 275件)との双方向突き合わせも完全一致。
3. `AGGREGATION_ID=01M1MKD73P0KDT719H21NJV9VR EMIT_LINEAGE=1 uv run python3 aggregation_run.py` をscreenセッション(`agg15go`)で起動。5ワーカー、6,373件の処理を開始。
4. 起動確認: load average 6.91まwhile上昇(ワーカー稼働確認)、`pmtiles-store`への書き込み開始を確認(872Gi使用、起動前869Giから増加)。

### 見込み

D124/D125の実測ベースで、aggregation本体だけで約50-70時間(2-3日)。完了後、downsampling(elevation・lineage両方)→bundle→**pmtiles cluster**(D127で追加確定)→merge(z0-7接合)→verify→Hidenoriさんの公開承認、と続く。

### 現在の状態

**1.5号、正式に稼働中**。定期監視(15分おき、ディスク・メモリ・進捗)を継続する。`check_disk_headroom.py`は既にpmtiles-storeもカバーする形に拡張済み(D127)。

### Resume prompt

> D128で1.5号(`01M1MKD73P0KDT719H21NJV9VR`)の全国aggregation本体が正式に起動(07:23 JST、screen: `agg15go`、5ワーカー、EMIT_LINEAGE=1)。起動前の名簿突き合わせは完全クリーン。見込み所要時間50-70時間。**次のアクション**: 定期監視を継続、完了次第downsampling(elevation・lineage)→bundle→pmtiles cluster→merge→verifyへ進む。公開はHidenoriさんの別途承認が必要。


## D129: slateがカーネルパニックで再起動、原因特定とワーカー数削減による復旧(19:54 JST)

**Status**: Recorded, 2026-09-04 20:15 JST。

### 発生した事象

定期監視中、19:56 JSTのチェックでslateのuptimeが「2分」であることを検知(直前のチェックでは3日超)。外部ボリューム(`Migrate-2025-04`・`pmtiles-store`)が両方ともアンマウント、`agg15go`・`disk_headroom`のscreenセッションが両方とも消失していた。

### 根本原因

`/Library/Logs/DiagnosticReports/`のパニックログ(19:54:34発生)を確認したところ、以下が判明:

```
panic_string: "watchdog timeout: no checkins from watchdogd in 91 seconds"
Compressor Info: 69% of compressed pages limit (OK) and 100% of segments limit (BAD) with 42 swapfiles
```

メモリコンプレッサーのセグメント上限に到達し、watchdogdへの応答が91秒間止まったことでカーネルパニックが発生した。これは本日繰り返し観測していた一過性のメモリpressure level 4スパイク(都度self-clearしたため「既知の良性パターン」と判断していたもの)が、実際には約12.5時間かけて徐々に悪化していたメモリ枯渇の兆候だったことを意味する。

`get_worker_count()`(`aggregation_run.py`)のデフォルト5ワーカーという設定は、D84(2026-09-01)でCPU使用率(4ワーカー時アイドル46-47%)のみを根拠に4→5へ引き上げられたものであり、**個々のワーカーがdenseなソースタイル処理時に見せるメモリスパイク(実測で単一ワーカーが最大7.7GB RSSまで達した例あり)は考慮されていなかった**。slateの物理メモリは16GB(`hw.memsize`)、5ワーカーが同時に大きめのタイルに当たる確率が約12時間の連続稼働のうちに積み重なり、最終的にコンプレッサーのセグメント上限を突破したとみられる。

### データ整合性の確認

再起動後、以下を確認しクリーンであることを検証:
- ボリュームは両方とも正常にマウント可能(`diskutil mount`成功、破損兆候なし)
- 名簿(`*-aggregation.csv`)は6,373件のまま不変
- `.done`マーカーは2,982件(クラッシュ直前の19:41チェック時点の2,965件から17件増、19:50頃まで正常に書き込まれていたことを確認)
- `tmp-store/01M1MKD73P0KDT719H21NJV9VR/`に5件の未完了アイテムのスクラッチディレクトリが残存(クラッシュ時点で処理中だった分)。`aggregation_run.py`は`os.makedirs(tmp_folder, exist_ok=True)`で既存ディレクトリを安全に再利用する設計のため、手動クリーンアップ不要——再実行時に自然に上書き・完走・`shutil.rmtree`で片付く。
- データ破損・誤ったpmtiles-store書き込みの兆候なし(atomic writeパターンにより未完了アイテムの部分データは最終アーカイブに混入しない)

### 復旧措置

1. `diskutil mount disk6s2` / `diskutil mount disk8s1` で両ボリュームを再マウント。
2. `disk_headroom`監視screenを再起動。
3. `agg15go`を**`AGGREGATION_WORKERS=3`(5から削減)**で再起動。他の環境変数(`AGGREGATION_ID`・`EMIT_LINEAGE=1`)は変更なし。コード変更は一切なし(env var一つのみの変更)。
4. 起動確認: 「using 3 workers」「start aggregating 3391 items...」を確認、3ワーカーとも生存・CPU busy、load averageが6.5-7.5台から4台前半へ低下、`.done`が再開後8分で2,982→3,026(約5.5件/分、ワーカー減にもかかわらず実用的なペースを維持)。

### 教訓・今後への申し送り

- `get_worker_count()`のデフォルト値決定は、CPU使用率だけでなくワーカーあたりの実メモリ使用量分布(特にdenseなタイルでのスパイク)も考慮すべき。次回(2号想定)着手前に、D84の根拠にこのメモリ観点を追記・再検討することを推奨。
- 「一過性のメモリpressureスパイクはself-clearするので無害」という当日の判断は、単発では正しかったが、**繰り返し頻度や傾向を見ずに個々のスパイクだけを見ていた**ことが今回の見落としにつながった。今後は同種のスパイクが繰り返し観測される場合、頻度・深刻度の傾向自体を追跡指標として扱う。
- データはロスなし、生成物の整合性も無傷。所要時間への影響は再起動までの空白時間(約20分弱)とワーカー減による多少のペース低下のみで、50-70時間という見積もりの範囲内に収まる見込み。

### Resume prompt

> D129: 19:54 JSTにslateがカーネルパニック(メモリコンプレッサーのセグメント上限到達、watchdog timeout)で再起動、`agg15go`・`disk_headroom`のscreenセッションが失われた。データ整合性を確認(名簿6,373件不変、`.done`2,982件で正常に途切れていた、破損なし)した上で、両ボリュームを再マウントし、`disk_headroom`を再起動、`agg15go`を**`AGGREGATION_WORKERS=3`(5から削減)**で再起動して復旧した。20:11時点で3,026/6,373件、正常稼働を確認。**次のアクション**: 定期監視を継続、今後もメモリpressureの繰り返し傾向に注意する。完了後の工程(downsampling以降)は変更なし。

**追記(Hidenoriさん事後承認、2026-09-04 20:30頃)**: ワーカー数3への削減を事後承認。「将来的に4までは戻す余地を認めるものの、まずは3で様子をみよう。速度の変化もね」とのこと。3ワーカーでのペース推移を監視し、安定していることが確認できれば4への引き上げを検討する。


## D130: ワーカー数最適化分析(5 vs 3の実測比較、Hidenoriさんの依頼による)

**Status**: Recorded, 2026-09-05 09:00頃。`mapterhorn-monitor`のprogress.json更新履歴(15分おき、計約95件のスナップショット)を実測データとして分析した。

### 比較

- **5ワーカー期**(07:23〜19:54、12.2時間、D129クラッシュで終了): 全体平均4.03件/分、ティック平均4.01件/分(標準偏差1.70)。load average平均6.80。メモリpressure level 4を少なくとも2回検知(09:09、10:39-10:55、いずれもその場の詳細調査で確認、ダッシュボードの15分スナップショットには1回のみ記録)。
- **3ワーカー期**(20:03〜09:05 08:42時点、12.5時間超、無事故で継続中): 全体平均3.10件/分、ティック平均3.16件/分(標準偏差1.48)。load average平均4.07。メモリpressure level 4は0回。最大単一ワーカーRSSは10.37GB(05:13)だが、他ワーカーが小さかったため合計約10.5GBに収まり無事解消。

### 知見

1. ワーカー数40%減(5→3)に対しスループット低下は23%のみ——単純な線形関係ではなく、3ワーカーの方がワーカーあたりの実効効率が高い(ディスクI/O・キャッシュ競合の減少と推測)。
2. D129クラッシュの本質は「単一の巨大タイル」ではない——3ワーカー期にそれより大きい10.37GBのワーカーRSSが発生しても何も起きなかった。真因は**高並行度(5)×長時間(12時間超)によるメモリコンプレッサーのsegment使用量の累積的枯渇**であり、短時間の稼働実績だけでは安全性を証明できない故障モード。

### 判断: 4ワーカーへの引き上げは見送り

- 3→5で得られたスループット向上(+30%)から補間すると、3→4の向上は+15%程度(約3.5-3.7件/分)にとどまる見込みで、伸びしろが小さい。
- 数時間の試験運用では「クラッシュしないこと」を証明できない(D129は12時間超かけて進行した累積故障)。
- 現在84%超・残り約1,000件のこの段階でワーカー数を変更する再起動リスクは正当化しにくい。

**今回のランは3ワーカーを維持して完走する。** 4ワーカーは、次の「2号」(高速化狙いの本番ラン)着手前に、独立した数時間規模のソークテストとして別途検証する候補として持ち越す。

### Resume prompt

> D130: Hidenoriさんの依頼でワーカー数(5 vs 3)の実測比較分析を実施。3ワーカーはスループット-23%に対しクラッシュ0件・メモリ安全マージン十分、5ワーカーはスループット+30%だが12時間超の累積負荷でカーネルパニックに至った。3→4の伸びしろは補間で+15%程度と小さく、短時間テストでは安全性を証明できない故障モードのため、**今回のランは3ワーカー継続、4ワーカーは2号着手前の専用ソークテスト候補として持ち越し**と判断。


## D131: ワーカー数、1.5号・2号とも3で固定(Hidenoriさん最終決定)

**Status**: Decided, 2026-09-05 11:30頃。D130の分析結果を受けたHidenoriさんの最終判断。

### 決定内容

D130は「今回のランは3を維持、4は2号着手前の専用ソークテスト候補として持ち越す」という中間的な結論だったが、Hidenoriさんはこれをさらに一歩進め、**4ワーカーの検証自体を行わず、1.5号(現行ラン継続)・2号(次の本番ラン)とも3ワーカーで固定する**ことを決定した。

> 3ワーカーで1.5号は固定するし、2号も3ワーカーで行くことにしよう。2割少し遅くなっても、事故が起こらないほうが良いと判断した。

D130の実測(3ワーカーはスループット-20〜23%と引き換えに、D129のようなクラッシュリスクを排除)を踏まえ、速度よりも安全性を優先する判断。

### 実施内容

`hfu-mapterhorn/pipelines/aggregation_run.py`の`get_worker_count()`のデフォルト値を**5→3**に変更(commit `8b19b17`)。これにより、2号では`AGGREGATION_WORKERS`環境変数を明示的に指定しなくても自動的に3ワーカーで動作する——「2号ではコードを変更しない」という本プロジェクトの方針(1.5号でのリファクタリング完了を前提とする)とも整合する。稼働中の1.5号プロセス自体はコード変更の影響を受けない(既にメモリにロード済みのため無関係)。

### Resume prompt

> D131: Hidenoriさんの最終決定により、ワーカー数を1.5号・2号とも3で固定することにした(4ワーカーのソークテストは行わない)。D130の実測(3ワーカーはスループット-20〜23%、クラッシュ0件)を踏まえ、速度より安全性を優先。`aggregation_run.py`の`get_worker_count()`デフォルトを5→3に変更しpush済み(`8b19b17`)。以後、2号でも`AGGREGATION_WORKERS`の明示指定なしに3ワーカーで動作する。


## D132: 1.5号 全国aggregation本体、完走(15:05 JST頃)。downsampling(elevation)着手

**Status**: Recorded, 2026-09-05 15:12 JST頃。

### 完了確認

07:23 JSTの起動(D128、D129のクラッシュ後20:03に3ワーカーで再起動)から
約31.5時間で全国aggregationが完走した。

- 名簿(`*-aggregation.csv`)6,373件と`.done`マーカー6,373件が完全一致、
  `.todo`0件。
- `tmp-store/01M1MKD73P0KDT719H21NJV9VR/`の未完了スクラッチディレクトリ
  0件——最後のアイテムまで正常にクリーンアップされた。
- `agg15go`スクリーンセッションはプロセス終了に伴い自然に消滅
  (異常終了ではなく、正常なプロセス終了によるscreenの自動クローズ)。
- 完走直前・直後の期間に新規カーネルパニックなし(`/Library/Logs/
  DiagnosticReports/`を確認)。

D129のクラッシュ(20分弱の中断)とワーカー減(5→3)による若干のペース
低下を踏まえても、D124/D125時点の見積もり(50-70時間)の範囲内で
完走した。

### 着手: downsampling(elevation)

D127のランブック通り、`downsampling_covering.py`を実行(正常完走、
covering CSVを`aggregation-store/01M1MKD73P0KDT719H21NJV9VR/`配下に
生成)。続けて`DOWNSAMPLING_STRICT=1 PRIORITY_MODE=quadrans uv run
python3 downsampling_run.py`をscreenセッション(`ds15go_elev`)で起動。
起動直後の確認で`.done`マーカーが順調に増加していることを確認。

lineage側(`DOWNSAMPLING_DATATYPE=lineage`)はelevation完走後に着手する
(D127ランブック通り、逐次実行)。

### Resume prompt

> D132: 1.5号(`01M1MKD73P0KDT719H21NJV9VR`)の全国aggregationが
> 2026-09-05 15:05 JST頃に完走(6,373/6,373、`.todo`0件、tmp remnant
> 0件、クリーン)。約31.5時間(D129の中断・3ワーカー減速込み)で
> 50-70時間の見積もり内。`downsampling_covering.py`実行後、
> `downsampling_run.py`(elevation、screen: `ds15go_elev`)を起動、
> 順調に進行中。**次のアクション**: elevation側downsampling完走を待ち、
> `DOWNSAMPLING_DATATYPE=lineage`で同様に起動。両方完了後、
> `bundle.py`(両datatype)→`merge_japan_bundles.py`(両datatype)→
> `./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と進む。
> 公開は引き続きHidenoriさんの別途承認が必要(D127)。
