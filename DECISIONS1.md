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

## D164: D120's Fable review tracking was itself stale — 5 of 6 items already fixed, the 6th fixed now

**Status**: Fixed, 2026-09-13. Same "the tracking table is stale, not the underlying work" pattern as D162, found this time in the middle of Hidenori's own "他に直すべきバグなどはあるか" (are there other bugs left to fix) question — see D120's own table below for the re-check.

D162(PLAN.mdの5m/10m項目)・D163(dirty-tracking)に続き、同じ「解決済みなのに記録だけ古いまま」パターンが今度はこの表自体で見つかった。Hidenoriさんの「他に直すべきバグはあるか」という問いを受けて実コードを1件ずつ再確認した結果:

| # | 指摘内容 | 再確認結果 |
|---|---|---|
| 2 | `TMPDIR`未設定 | **修正済み**。`extract_z8plus.py`/`build_global_overview.py`とも冒頭で`os.environ['TMPDIR']`を明示設定するコードが既に入っている(いつ入ったかの個別コミットは未特定だが、恐らく1.5号pre-launch hardeningの一環)。 |
| 3 | `run_command()`が終了コードを見ていない | **修正済み**。`utils.run_command()`は`check=True`がデフォルトになっており、コード内コメントに**「mapterhorn-japan-bridge DECISIONS.md D120 Fable review item #3」と明記**——この項目自体を指して直したという記録が実装コメントに残っている。 |
| 4 | `merged-3857.tiff`の非原子的書き込み | **今回(2026-09-13)修正**。唯一、実際に未修正のまま残っていた項目——後述。 |
| 5 | `remove_dangling_pmtiles.py`の危険な設計 | **修正済み**。ファイル冒頭のdocstringに**「rewritten 2026-09-04, mapterhorn-japan-bridge DECISIONS.md D120 Fable review item #5」と明記**。世代IDを明示指定必須(「latest」推測禁止)、generation_idスコープのサブツリーのみ走査、1号の旧flat構造は明示的に拒否、dry-runがデフォルト——指摘の3点全てに対処済み。 |
| 6 | `.done`マーカーがdatatypeでスコープされていない | **修正済み**。D119/D120自身の予告通り、`write_done_manifest()`の`datatype`フィールド導入(D95/D107以降の namespace分離作業の一環)で自然に解消。`done_covers()`/`done_is_current()`が`datatypes`集合を見て判定する現行実装で確認。 |

**つまり実質的には#4の1件を除いて全て決着していたが、この表自体は2026-08-29の記録のまま一度も更新されていなかった。** #2/#3/#5は実装コメント・docstringが自らD120のこの表を名指しして「直した」と書いているのに、この表側は追いついていなかった——コードのコミットメッセージ/コメントとDECISIONS.mdの記述が非同期になりうる典型例。

**#4(`aggregation_merge.py`の非原子的書き込み)は本セッションで修正**: `merged-3857.tiff`への直接書き込み(`rasterio.open(output_path, 'w', ...)`、単一グループ・複数グループ両方の書き込みブランチ)を、`tmp_output_path = f'{output_path}.tmp'`への書き込み+書き込み完了後の`os.replace()`に変更(`utils.create_archive()`等、このコードベースで既に確立されているtmp+os.replaceパターンを踏襲)。関数冒頭の再開ロジック(`if os.path.isfile(output_path):` → 「既に完了済みとみなしてクリーンアップだけ済ませる」)は元々このFable指摘が懸念していた「部分書き込みされたファイルを完了と誤認する」リスクを実際に抱えていた——今回の修正で、`output_path`が存在する時点でそれは常に完全な書き込みの結果であることが保証されるため、この再開ロジック自体は無変更で安全になった。

実データで両ブランチとも動作確認(隔離した一時ディレクトリ、本番データは一切変更せず):
- 単一グループ(jpnationalsea×4ファイル、`10-864-438-12`): 正常完了、出力は有効なGeoTIFF(2048×2048、-9999残留ゼロ)。
- 複数グループ(`jpnational10`+`jpnationalsea`、`11-1723-880-13`): 正常完了、境界ブラー処理を含む本格的なマージパスを実際に通過。出力は実地形データ(標高範囲-0.57〜230.3m、平均4.5m、対馬近海と整合)、`.tmp`ファイルの残留なし。

**このセッションでの教訓**: 「まだ直っていないバグはあるか」という問いに答えるには、DECISIONS.mdの`未対応`という記載を鵜呑みにせず、必ず実コードを読んで確認する必要がある——D162と全く同じ教訓が、今度は「バグ一覧」というより高リスクな文脈で再現した。

**ついでに確認、真のバグではないと確認できたもの**: D119由来の「`get_pmtiles_folder()`のz<7ギャップ(P2.A、67ファイルが不可視)」も同じ棚卸しで再確認した。これは**1号(`FLAT_LEGACY_GENERATION_ID`)専用のフォールバック分岐が`z>=7`でしか発火しない**という構造であり、コード自体は現行のまま(`hfu-mapterhorn` `utils.py`の`get_pmtiles_folder()`を直接確認)。ただし当時の記録自身が「1.5号は`min_output_zoom=8`なのでz<7ファイルは存在しない、起動判断には影響しない」と明記しており、実際1.5号はz<7ファイルを一切生成していない。D146のlineage低ズーム拡張(z8→z4)は「z<7の新規生成」という当時懸念されていたシナリオそのものだが、これは1.5号自身の(非legacy)generation_idの下で新しいレイヤー構造にそのまま書き込まれるだけで、legacy分岐(1号専用)を一切通らないため無関係——実際D146は実装・公開・D154/D161の実地確認まで完了しており問題は起きていない。2号も新規generation_idを使う以上、この分岐には触れない。**結論: 真のギャップではあるが、1号の遺産データ専用スコープに限定されており、1.5号でも2号でも発現しない。放置して問題ない。**

### 追記(2026-09-13): D163自身の自己レビュー(`/code-review` high)で10件発見、全件修正

Hidenoriさんの方針(「Claude側の指摘が全部クリアになったらOpusにも正式レビューしてもらう」)に従い、D163/D164自身の変更を`/code-review`スキル(high、8角度・実データ検証込み)で棚卸しした。10件の指摘、全て修正・実データ再検証済み(`hfu-mapterhorn` commit `6a401bc`)。

**最重要**: `done_is_current()`の「legacyマニフェストは無条件でelevation扱いのcurrent」というバイパス条件が、新設のreuseチェックから到達可能なままだった——**前世代の`.done`がD119以前のlegacy(空`{}`)または破損JSONだった場合、フィンガープリント比較を一切行わずに`True`を返してしまう**。1.5号は今回backfill済みなので実害はまだ発生していないが、これは構造的にD163が閉じたかったD18/D35の穴(「中身が変わったのにフィンガープリントを見ずに信用する」)がそっくりそのまま再現しうる設計ミスだった。`try_reuse_from_previous_generation()`に「前世代の`.done`が実マニフェスト(空でない)であること」を明示的に要求するガードを追加、legacy previous-generationを意図的に再現したテストで拒否されることを確認。

その他9件(全て修正・実データ再検証込み):
- `write_aggregation_todos()`のループで例外処理が無く、1件の異常(存在しないソース参照等)がgeneration全体のcovering処理をクラッシュさせうる→try/exceptで1件ずつ隔離。
- `get_source_md5_map()`の手書きCSVパース(`rsplit`)が`source_download.py`の既存`csv.DictReader`方式より脆弱→統一。
- 前世代の出力ファイル実在チェック(安い)より先に高コストなMD5計算をしていた→順序入れ替え。
- `REQUIRED_DATATYPES`/エントリ構築式が複数ファイルに独立重複→`utils.get_required_datatypes()`/`utils.aggregation_fingerprint_entries()`/`utils.read_aggregation_csv_rows()`に統合。
- `aggregation_merge.py`のtmpファイル名に他の原子的書き込みヘルパーと同じPIDサフィックスを追加(念のための多重防御)。
- backfillスクリプトに1件ずつのtry/exceptと、「ソースマニフェストがアイテム構築後に変わっていないか」の実行時チェックを追加(ドキュメントに書いてあるだけだった前提を実際に強制)。

全修正後、既存のテストスイート(正常系・異常系・D18/D35型・複数ソース・複数datatype)に加え、実際の`write_aggregation_todos()`を3アイテム混合(再利用成功・内容変更で失敗・新規で失敗)でend-to-end再実行し、全て期待通りであることを確認。1.5号の実データは一貫してバイト単位で無変更。

**次のステップ**: Hidenoriさんの方針通り、この時点でOpusによる正式な独立コードレビューへ進む。

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


## D133: downsampling_run.pyもデフォルト5ワーカーだったと判明。Hidenoriさんの判断で5のまま継続、監視強化

**Status**: Decided, 2026-09-05 16:53頃〜17:08 JST。

### 発見

downsampling(elevation)の定期監視中、`.done`増加ペースの変化を追う過程で
プロセス一覧を確認したところ、`downsampling_run.py`が`aggregation_run.py`
とは別の`get_worker_count()`を持ち、デフォルトが**5のまま**であることが
判明した。D131の「3ワーカー固定」はコード上`aggregation_run.py`にしか
適用されておらず、現在稼働中のdownsampling(elevation、screen
`ds15go_elev`)は実際には5ワーカーで動いていた(起動から約100分間、
プロセス`54292-54296`がいずれもCPU 94-100%で稼働継続)。

### 実測によるリスク評価

Hidenoriさんに状況を報告した上で判断を仰いだ。判断材料として、5ワーカー
稼働から約100分経過時点の実測値を確認:

- 各ワーカーのRSS: **約1.67-1.68GB**(D129でaggregationワーカーが記録した
  最大7.7-10.37GBの1/5以下)
- swap使用量: 114MB/1024MB(ごくわずか)
- メモリコンプレッサーのpages stored: 36,239(D129クラッシュ時の
  「segmentsの100%到達」とは桁違いに低水準)
- `kern.memorystatus_vm_pressure_level`: 1(正常)を約100分間維持

downsamplingの1アイテムあたりのメモリフットプリントは、aggregationの
生GeoTIFF処理よりはるかに軽い(既存の親タイルPMTilesからの読み込み・
再エンコードが中心)ことが、この実測で裏付けられた。D129の故障機序
(高並行度×長時間によるコンプレッサーsegment枯渇)が同じ確率で再現する
根拠は、現時点の実測からは見出せない。

### 決定

**Hidenoriさんの判断: 5ワーカーのまま継続、監視を強化して様子を見る**。
3ワーカーへの制限・再起動は行わない(D124の`.done`マニフェスト設計により
再起動自体は安全だが、進行中アイテムのやり直し・スループット低下という
コストが発生するため、実測が安全側に振れている現状ではその代償を払わない
という判断)。

以後の定期監視では、`.done`増加ペースに加えて、ワーカーRSS・swap使用量・
メモリコンプレッサーのpages storedも定期的に確認し、悪化の兆候(RSSの
継続的な増加傾向、pressure level上昇)が出た時点で3ワーカーへの切替えを
再検討する。

### Resume prompt

> D133: downsampling_run.pyのデフォルトワーカー数もD131の見直し対象外の
> まま5だったと判明(aggregation_run.pyのみ修正されていた)。約100分間の
> 5ワーカー稼働実績を実測(ワーカーRSS約1.67GB、swap114MB、pressure
> level 1で安定)した上でHidenoriさんに判断を仰ぎ、**5のまま継続、監視
> 強化**の方針で合意。今後の定期監視ではワーカーRSS・swap・compressor
> pages storedも合わせて確認し、悪化の兆候があれば3ワーカーへの切替えを
> 再検討する。**次のアクション**: 監視強化を続けつつdownsampling
> (elevation→lineage)の完走を待つ。


## D134: downsampling(elevation)完走(20:3x JST頃)。lineage側着手

**Status**: Recorded, 2026-09-05 20:37 JST頃。

### 完了確認

`downsampling_run.py`(elevation、`DOWNSAMPLING_STRICT=1
PRIORITY_MODE=quadrans`)が15:10 JST着手から約5.5時間で完走した。

- `*-downsampling.done`マーカーと`*-downsampling.csv`(covering)が
  ともに8,223件で一致。
- プロセスは正常終了(screenの`exec bash`フォールバックのみが残存、
  異常終了の痕跡なし)。
- D133で開始した強化監視(ワーカーRSS・swap・compressor)の結果、
  全期間を通じてswapは82-114MBの範囲で安定、累積的な右肩上がりは
  一度も観測されず——5ワーカーのまま完走して問題なかった。

### 着手: downsampling(lineage)

`ds15go_elev`スクリーンを終了し、`DOWNSAMPLING_DATATYPE=lineage
DOWNSAMPLING_STRICT=1 PRIORITY_MODE=quadrans uv run python3
downsampling_run.py`を新規スクリーン(`ds15go_lineage`)で起動。
D127ランブック通り、elevation完走後にlineageへ逐次進む形。

### Resume prompt

> D134: 1.5号のdownsampling(elevation)が2026-09-05 20:3x JST頃に完走
> (8,223/8,223、covering数と一致、プロセス正常終了)。D133の強化監視
> (5ワーカーのままのRSS・swap追跡)は全期間を通じて悪化傾向なしと
> 確認済み。続けてdownsampling(lineage、screen `ds15go_lineage`)を
> 起動。**次のアクション**: lineage側の完走を待ち、`bundle.py`
> (elevation・lineage両方)→`merge_japan_bundles.py`(両方)→
> `./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と進む。
> `meta-store/bundle/*.json`はbundleステージ直前にクリアすること
> (D125のD4項目)。公開はHidenoriさんの別途承認が必要(D127)。


## D135: downsampling(lineage)完走。両datatypeのdownsampling完了、bundleステージへ

**Status**: Recorded, 2026-09-05 22:37 JST頃。

### 完了確認

`downsampling_run.py`(lineage、`DOWNSAMPLING_DATATYPE=lineage
DOWNSAMPLING_STRICT=1 PRIORITY_MODE=quadrans`)が20:37 JST着手から
約2時間で完走した。

- `*-downsampling.lineage.done`マーカーと`*-downsampling.csv`
  (covering)がともに8,223件で一致。
- プロセスは正常終了、load averageが1.8-3.2まで低下。
- D133で開始した強化監視の結果、lineage側もworker RSS 0.12-0.17GB・
  swap 74MB前後で全期間安定、悪化傾向なし。elevationよりさらに軽量
  (カテゴリ値の単一バンドPNGのため)。

**これでdownsampling(elevation・lineage両方)が完了**。

### 着手: bundleステージ

D125のD4項目通り、`meta-store/bundle/*.json`(1号時代の古いメタデータ
23件)を事前にクリアしてから`bundle.py`を実行。

`bundle.py 1`(elevation、BUNDLE_DATATYPE未指定=デフォルトelevation)を
screen(`bundle15go_elev`)で起動。起動ログで以下を確認:
- datatype: elevation
- generation: `01M1MKD73P0KDT719H21NJV9VR`(1.5号、latest
  aggregation-store idとして正しく自動検出)
- 4ワーカー

elevation完走後、`BUNDLE_DATATYPE=lineage`で同様にlineage側を実行する。

### Resume prompt

> D135: 1.5号のdownsampling(lineage)が2026-09-05 22:37 JST頃に完走
> (8,223/8,223)。これでdownsampling(elevation・lineage両方)完了。
> D133の強化監視は全期間で悪化傾向なしと確認。`meta-store/bundle/
> *.json`(1号時代の23件)をクリアした上で`bundle.py 1`
> (elevation、screen `bundle15go_elev`)を起動、generation/datatype
> とも正しく認識されていることをログで確認済み。**次のアクション**:
> bundle(elevation)完走を待ち、`BUNDLE_DATATYPE=lineage`で同様に実行。
> 両方完了後、`merge_japan_bundles.py`(両datatype)→
> `./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と進む。
> 公開はHidenoriさんの別途承認が必要(D127)。


## D136: bundle(elevation)完走。lineage側着手

**Status**: Recorded, 2026-09-05 23:37 JST頃。

### 完了確認

`bundle.py 1`(elevation)が22:38 JST着手から約1時間で完走した。

- ログに「The following 23 file(s) were created:」と出力、
  `planet.pmtiles`+22件の`{z6}-{x}-{y}.pmtiles`地域バンドルを確認。
- 1号実績(D99、約30分)よりやや長め(約60分)だったが、異常な
  遅延ではない——エラー・警告なし、正常終了。
- ディスク消費は一時的にMigrate-2025-04で最大約320GB相当まで
  進んだが、bundle完走後にpmtiles-storeの空き容量が回復傾向
  (609→703GB)を見せており、想定内の一時的な中間ファイル増加
  だったと判断できる。

### 着手: bundle(lineage)

`bundle15go_elev`スクリーンを終了し、`BUNDLE_DATATYPE=lineage
uv run python3 bundle.py 1`を新規スクリーン(`bundle15go_lineage`)で
起動。起動ログでdatatype=lineage・generation=`01M1MKD73P0KDT719H21NJV9VR`
が正しく認識されていることを確認。

### Resume prompt

> D136: 1.5号のbundle(elevation)が2026-09-05 23:37 JST頃に完走
> (23ファイル生成、`planet.pmtiles`+22地域バンドル、エラーなし)。
> 続けて`bundle.py`(lineage、screen `bundle15go_lineage`)を起動、
> datatype/generationとも正しく認識されていることを確認済み。
> **次のアクション**: bundle(lineage)完走を待ち、
> `merge_japan_bundles.py`(elevation・lineage両方)→
> `./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と進む。
> 公開はHidenoriさんの別途承認が必要(D127)。


## D137: bundle(lineage)完走。両datatypeのbundle完了、merge_japan_bundles.py着手

**Status**: Recorded, 2026-09-06 00:08 JST頃。

### 完了確認

`bundle.py 1`(lineage、`BUNDLE_DATATYPE=lineage`)が23:37 JST着手から
完走した。ログに「The following 23 file(s) were created:」——
`planet-lineage.pmtiles`+22件の地域`-lineage.pmtiles`バンドルを確認、
エラーなし。**これでbundle(elevation・lineage両方)が完了**。

一時、`tail -15`で確認したログが偶然ファイル生成リストの末尾と一致し、
「15分間ログ変化なし=停滞」と誤認しかけたが、`tail -60`で全文確認した
ところ実際には正常完走していたことが判明——ログの一部だけを見て
停滞と判断するのは早計だった、という教訓。

### 着手: merge_japan_bundles.py(elevation)

`merge_japan_bundles.py`をscreen(`merge15go_elev`)で起動。この工程は
D49で過去に1号本番中にディスクを100%枯渇させた実績がある最も注意を
要するステージ(pmtilesライブラリの内部temp fileがTMPDIRを無視して
起動ディスクを圧迫した事故、D104/D105で恒久対応済み)。起動直後は
D119由来の完全性チェック(bundle-storeの22件の地域バンドルの
サイズ・マニフェスト検証)にCPU時間を使っており、正常に進行中
(ディスクも安定)。

### Resume prompt

> D137: 1.5号のbundle(elevation・lineage両方)が完了(bundle.py×2回、
> 各23ファイル生成、エラーなし)。`merge_japan_bundles.py`
> (elevation、screen `merge15go_elev`)を起動、完全性チェック段階を
> 正常に通過中。この工程はD49の過去のENOSPC事故があった要注意ステージ
> ——ディスクを継続的に注視すること。**次のアクション**: merge
> (elevation)完走を待ち、`MERGE_DATATYPE=lineage`で同様に実行。両方
> 完了後`./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と
> 進む。公開はHidenoriさんの別途承認が必要(D127)。


## D138: merge_japan_bundles.py(elevation)完走。lineage側着手

**Status**: Recorded, 2026-09-06 01:07 JST頃。

### 完了確認

`merge_japan_bundles.py`(elevation)が00:08 JST着手から約1時間で
完走した。

- D119の完全性チェック: 「completeness check OK: 23 bundle(s),
  290.0 GiB」——23件の地域バンドル(bundle-store)を検証、欠落なし。
- 23ファイルを順次マージし、`bundle-store/mapterhorn-japan-bridge.
  z8plus.pmtiles`(2,568,061タイル)を生成。エラー・警告なし。
- D49で過去にディスクを100%枯渇させた実績のある要注意ステージ
  だったが、途中一時的にpmtiles-storeの空き容量が413GBまで減少した
  ものの、その後横ばい・回復し、最終的にMigrate-2025-04 677GB・
  pmtiles-store 703GB空きで完走(枯渇の兆候なし)。

### 着手: merge_japan_bundles.py(lineage)

`merge15go_elev`スクリーンを終了し、`MERGE_DATATYPE=lineage uv run
python3 merge_japan_bundles.py`を新規スクリーン(`merge15go_lineage`)
で起動。

### Resume prompt

> D138: 1.5号のmerge_japan_bundles.py(elevation)が2026-09-06 01:07
> JST頃に完走(23件の地域バンドル290GiB分を完全性チェック通過後に
> マージ、`mapterhorn-japan-bridge.z8plus.pmtiles`2,568,061タイル生成、
> エラーなし、D49型のディスク枯渇兆候もなし)。続けて
> `merge_japan_bundles.py`(lineage、screen `merge15go_lineage`)を
> 起動。**次のアクション**: lineage側merge完走を待ち、
> `./pmtiles cluster`→`verify`→`merge`(z0-7接合)→`verify`と進む。
> 公開はHidenoriさんの別途承認が必要(D127)。


## D139: merge_japan_bundles.py(lineage)完走。両datatypeのmerge完了、pmtiles cluster着手

**Status**: Recorded, 2026-09-06 01:22 JST頃。

### 完了確認

`merge_japan_bundles.py`(lineage、`MERGE_DATATYPE=lineage`)が完走。

- D119完全性チェック: 「completeness check OK: 23 bundle(s), 0.2 GiB」
  ——lineageはカテゴリ値単一バンドのため入力サイズがelevationの
  290GiBに対し0.2GiBと極小、完走も高速だった。
- `bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`
  (2,568,061タイル、elevation側と完全に同じタイル数——両datatypeが
  同一のcovering/座標集合から生成されている一貫性の裏付け)を生成。
- D96/D124のランブック通り、lineageはこの時点で**既に最終ファイル名**
  (elevationのような`.z8plus`中間名ではない)——lineageには既存の
  グローバルMapterhornオーバービュー(z0-7)を接合する対象が存在
  しないため、`pmtiles merge`によるz0-7接合はelevation側のみに適用する。

**これでbundle_japan_bundles.py(elevation・lineage両方)が完了**。

### 着手: pmtiles cluster(elevation z8plusのみ)

D127で追加確定した`./pmtiles cluster`ステップを実行。`./pmtiles`
ラッパー経由でTMPDIRが`pmtiles-store/tmp-store/go-cli-scratch`
(起動ディスクではない)に正しく設定されていることを確認
(D124 Phase-2堅牢化の効果)。対象は`bundle-store/mapterhorn-japan-
bridge.z8plus.pmtiles`(311GB、2,101,520アイテム)、実行時間見積もり
約20分。lineage側はcluster対象外(D124ランブック通り、直接verify)。

### Resume prompt

> D139: 1.5号のmerge_japan_bundles.py(lineage)が2026-09-06 01:22
> JST頃に完走(`mapterhorn-japan-bridge-lineage.pmtiles`
> 2,568,061タイル、elevation側とタイル数完全一致)。これで両datatype
> のbundle_japan_bundles.pyが完了。D124ランブック通り、lineageは
> ここで最終ファイル名——z0-7接合(pmtiles merge)はelevation側のみに
> 適用する。`./pmtiles cluster`(elevation z8plus、TMPDIRラッパー
> 経由、約20分見積もり、screen `cluster15go`)を起動。**次のアクション**:
> cluster完走を待ち、`./pmtiles verify`(elevation z8plus)→
> `./pmtiles merge`(global-overview-backup.pmtilesとのz0-7接合、
> 最終`mapterhorn-japan-bridge.pmtiles`生成)→`./pmtiles verify`
> (最終elevation)、および`./pmtiles verify`
> (`mapterhorn-japan-bridge-lineage.pmtiles`、cluster不要で直接)と
> 進む。公開はHidenoriさんの別途承認が必要(D127)。


## D140: pmtiles cluster(elevation)完走・verify OK。z0-7オーバービュー接合(pmtiles merge)着手

**Status**: Recorded, 2026-09-06 02:08 JST頃。

### 完了確認

`./pmtiles cluster bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles`
が01:23 JST着手から約26分で完走した。

- 統計出力: addressed tiles 2,568,061、tile entries(RLE後)2,101,520、
  tile contents 2,075,843。
- 出力ファイルサイズは311.4GB(クラスタ化前とほぼ同一——想定通り、
  cluster処理はタイルの物理配置最適化が主目的でサイズ自体は
  大きく変わらない)。
- `./pmtiles verify`即座に実行、256ms で完走・クリーン。

### 着手: z0-7オーバービュー接合

`./pmtiles merge bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles
/Volumes/Migrate-2025-04/global-overview-backup.pmtiles
bundle-store/mapterhorn-japan-bridge.pmtiles`をscreen
(`mergesplice15go`)で起動。293GB分のタイルデータをマージ、
見積もり約30分。TMPDIRラッパーは正しく機能。

これが完走すれば`bundle-store/mapterhorn-japan-bridge.pmtiles`
(最終公開名)が生成される。lineage側(`mapterhorn-japan-bridge-
lineage.pmtiles`)は既に最終ファイルのため、別途`./pmtiles verify`
のみで完結する(D139参照)。

### Resume prompt

> D140: 1.5号のpmtiles cluster(elevation)が2026-09-06 01:49 JST頃に
> 完走(約26分、311.4GB、verify OKクリーン)。続けて`./pmtiles merge`
> でglobal-overview-backup.pmtiles(z0-7)を接合中(screen
> `mergesplice15go`、293GB、見積もり約30分)。**次のアクション**:
> 接合完走を待ち、`./pmtiles verify`(最終`mapterhorn-japan-
> bridge.pmtiles`)を実行。並行して(または続けて)
> `./pmtiles verify bundle-store/mapterhorn-japan-bridge-lineage.
> pmtiles`も実施。両方verify OKになれば、1.5号の全パイプライン
> ステージが完了し、公開はHidenoriさんの承認を待つのみとなる(D127)。


## D141: 1.5号 全パイプラインステージ完了(elevation・lineage両方verify OK)。公開承認待ち

**Status**: Recorded, 2026-09-06 03:08 JST頃。

### 完了確認

`./pmtiles merge`によるz0-7グローバルオーバービュー接合(elevation)が
02:08 JST着手から約49分で完走、`bundle-store/mapterhorn-japan-
bridge.pmtiles`(最終公開名)を生成した。続けて両ファイルの最終
`pmtiles verify`を実施:

- **elevation**(`mapterhorn-japan-bridge.pmtiles`、314.66GB):
  verify OK(258ms)。`pmtiles show`で確認したメタデータ:
  bounds全球(-180〜180, -85.05〜85.05——z0-7グローバルオーバービュー
  接合により正しく全球化)、zoom 0-16、center (140.9, 41.85)
  zoom 12(D87の風不死岳設定が正しく反映)、addressed tiles
  2,581,585、**clustered: true**。center座標が意味のある値になって
  おり、PLAN.md §4で警告されていた「1号のcenterが[0,0,2]という
  無意味な値になっていた不具合」は再発していない。
- **lineage**(`mapterhorn-japan-bridge-lineage.pmtiles`、204.6MB):
  verify OK(42ms)。bounds日本域(118.125〜157.5, 16.64〜48.92)、
  zoom 8-16(min_output_zoom=8通り)、center同じく(140.9, 41.85)、
  addressed tiles 2,568,061(elevation splice前と一致)、
  **clustered: false**(D124ランブック通り、clusterはelevationのみ
  対象)。

**これで1.5号(`01M1MKD73P0KDT719H21NJV9VR`)の全パイプラインステージ
(aggregation→downsampling×2→bundle×2→merge×2→cluster→verify→
z0-7接合→verify)が完了した。**

### 残るステップ

D127ランブック最終項目、**Hidenoriさんの明示的な公開承認**を得てから
starsへの手動rsyncのみ(`publish_cycle.py`は引き続きハードガード、
使用しない)。

### Resume prompt

> D141: 1.5号の全パイプラインステージが完了(2026-09-06 03:08 JST頃)。
> elevation(`mapterhorn-japan-bridge.pmtiles`、314.66GB、zoom 0-16、
> clustered、center正常)・lineage(`mapterhorn-japan-bridge-
> lineage.pmtiles`、204.6MB、zoom 8-16)ともにverify OK。**次のアクション**:
> Hidenoriさんに公開承認を確認し、承認が得られ次第starsへの手動rsync
> (両ファイル)を実施する。それまでは何も公開しない。


## D142: Hidenoriさん公開承認、starsへの転送着手(D122方式、旧1号ファイル削除→新規転送)

**Status**: Recorded, 2026-09-06 06:39 JST頃。

### 承認内容

Hidenoriさんより「公開承認する」の明示的承認を得た。starsのディスク
空き容量(150GB、1.8TB中92%使用済み)を事前確認したところ、1号の
現行公開ファイル(313.9GB)と1.5号のelevationアーカイブ(314.66GB)を
同時に置けるだけの余裕がないことが判明——D122と全く同じ状況。この点を
明示的にHidenoriさんへ再確認し(「旧ファイルを先に削除してから転送、
転送中約8時間ライブサイトダウン」)、**D122と同方式での実施の承認**を
別途得た。

stars上の`/home/stars/data/`は複数プロジェクト共有ディレクトリ
(kitaphoto17.pmtiles 190GB、seamlessphoto512.pmtiles 767GB、
z18.pmtiles 424GBなど)であることを確認——削除対象は本プロジェクトの
ファイル1件のみで、他プロジェクトへの影響はない。

### 実施内容

1. `/home/stars/data/mapterhorn-japan-bridge.pmtiles`(1号、313.9GB)
   を削除。
2. `bundle-store/mapterhorn-japan-bridge.pmtiles`(1.5号elevation、
   314.66GB)を`stars.local:/home/stars/data/mapterhorn-japan-bridge.
   pmtiles.new`へrsync転送開始。
3. 続けて`mapterhorn-japan-bridge-lineage.pmtiles`(204.6MB、
   lineageの初回公開)も同様に転送予定。

**トラブル**: 当初`rsync --info=progress2`を使ったところ、slateの
rsyncがmacOS標準の`openrsync`(protocol 29互換、BSD版)で該当
オプション未対応と判明、即座に`-avW --progress`へ変更して再実行
(旧ファイル削除は既に完了していたため、転送再開のみで対応)。

転送速度は約11MB/s、推定所要時間7.5時間——D122の実績
(313.9GBに約7時間48分)と一致、想定通り。

### 未完了ステップ(転送完了後、screen `publish15go`が自動継続)

- lineage転送
- stars側`pmtiles verify`(elevation・lineage両方)
- アトミックリネーム(`.new`→本番名)
- `systemctl --user restart martin`

### Resume prompt

> D142: Hidenoriさんの公開承認を得て、starsへの1.5号公開作業に着手
> (2026-09-06 06:39 JST頃)。D122と同方式(旧1号ファイル削除→新規
> 転送)、Hidenoriさんに8時間ダウンタイムを明示して別途承認済み。
> `publish_1p5go.sh`をscreen(`publish15go`)で実行中——elevation
> 転送→lineage転送→stars側verify×2→アトミックリネーム×2→martin
> 再起動、まで自動で進む設計。転送速度約11MB/s、推定7.5時間。
> **次のアクション**: 定期的に`/tmp/publish_1p5go.log`を確認し、
> 完走・エラーの有無を監視する。完走すればstarsの公開URLで実地確認
> (D122と同様、既知の座標での応答確認)を行う。


## D143: lineageにも`pmtiles cluster`を適用(D124/D127の想定を拡張)。elevationより大きい重複統合効果を確認

**Status**: Decided, 2026-09-06 07:14 JST頃。

### 経緯

D124/D127のランブックでは、z0-7グローバルオーバービュー接合が必要な
elevationのみ`pmtiles cluster`の対象とし、lineageは
`merge_japan_bundles.py`の出力をそのまま最終ファイルとする設計
だった(D139)。Hidenoriさんから「lineageにもclusterした方が良いのでは」
との提案を受け、実際に試して数値で判断した。

### 実測結果

`./pmtiles cluster bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`
を実行(所要時間3.4秒、205MBの小規模ファイルのため実質無視できる
コスト)。

| | addressed tiles | tile contents(実体) | 重複率 |
|---|---|---|---|
| elevation(D140実測) | 2,568,061 | 2,075,843 | 約19% |
| **lineage** | 2,568,061 | **422,889** | **約83.5%** |

lineageはカテゴリ値(provenance tier、0-6の離散値)の単一バンドデータ
のため、広大な同一値領域(例: 海=tier 6の連続領域)がバイト完全一致
のタイルとして大量に存在し、elevationよりはるかに高い重複率を示した。
`pmtiles verify`もクリーン(50ms)、`pmtiles show`で`clustered: true`
を確認。

### 判断

**コストがほぼゼロ(3.4秒)でダウンサイドが見当たらない**ため、
lineageにもclusterを適用する方針とした。ファイルは同一パス
(`bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`)に上書きで
生成されたため、進行中の公開転送(D142、screen `publish15go`)は
コード変更不要でこのクラスタ化済みファイルをそのまま転送する
(elevation転送完了後、lineageの番が来る時点でまだ転送前だった
ため間に合った)。

D124/D127のランブック文書は「lineageはcluster不要」という前提で
書かれているため、今後のセッション向けに本エントリで訂正しておく。

### Resume prompt

> D143: Hidenoriさんの提案でlineageにも`pmtiles cluster`を適用、
> elevation(重複率約19%)よりはるかに高い重複率(約83.5%)を実測で
> 確認、コストは3.4秒のみ。verify OK、clustered: true。
> D124/D127のランブックにあった「lineageはcluster対象外」という
> 前提を訂正——lineageもcluster対象に含める。進行中の公開転送
> (D142)はファイル上書きにより自動的にこのクラスタ化済み版を使う。
> **次のアクション**: 公開転送(elevation→lineage→verify→rename→
> martin再起動)の完走を待つ。


## D144: `merge_japan_bundles.py`自体にcluster呼び出しを組み込み、2号以降もコードで保証

**Status**: Accepted, 2026-09-06 07:xx JST頃。

### 背景

D143でlineageにもclusterを適用したが、あの時点では手動で
`./pmtiles cluster`をCLIから叩いただけだった。Hidenoriさんから
「2号以降でも、確実にlineageがclusterされることをコード面で担保して
ほしい」との指示を受けた——ランブックに手順として書くだけでは、
将来のセッション(人間・エージェント問わず)が読み飛ばす/省略する
リスクが残るため。

### 実施内容

`hfu-mapterhorn/pipelines/merge_japan_bundles.py`の`main()`末尾、
`OUTPUT`書き込み完了直後に、`utils.run_command()`
(D124 Phase-2導入、失敗時に例外を投げる安全な実行ヘルパー)経由で
`./pmtiles cluster {OUTPUT}`を無条件に呼び出すよう変更(commit
`4b0603e`、`hfu-mapterhorn`リポジトリ)。

これにより:
- **datatypeを問わず**(elevation・lineageとも)、`merge_japan_
  bundles.py`を実行するだけでclusterまで完了した状態になる。
- 人間・エージェントが「lineageもclusterする」という手順を覚えて
  おく必要がなくなり、2号以降のランブックからこのステップが
  事実上消える(スクリプト自身の一部になったため)。
- elevationについては、この時点でclusterされるのは`.z8plus`
  中間ファイル——その後の`pmtiles merge`(z0-7接合)は、D141で
  観測した通りclustered状態を引き継ぐため、追加のcluster呼び出しは
  不要。

### Resume prompt

> D144: Hidenoriさんの指示により、`pmtiles cluster`をランブームの
> 手順としてではなく`merge_japan_bundles.py`自体のコードに組み込んだ
> (`hfu-mapterhorn`commit `4b0603e`)。datatypeによらず、merge実行
> 直後に無条件でclusterが走るため、2号以降は人間・エージェントが
> 覚えておく必要がなくなった。**次のアクション**: 公開転送の完走を
> 待つ(この変更は稼働中の1.5号公開作業には影響しない——1.5号の
> ファイルは既にclusterされた状態でstarsへ転送中)。


## D145: 1.5号、stars公開完了。実地確認クリーン——1.5号ミッションコンプリート

**Status**: Recorded, 2026-09-06 14:55 JST頃。

### 公開完了

`publish_1p5go.sh`が06:39 JST着手から約8時間4分(14:43:15完了)で
完走した。

- elevation転送: 314.66GB、約7時間48分(約11MB/s、D122の実績と
  ほぼ一致)。転送完了後、rsyncクライアント側で追加約30分の
  ファイナライズ(チェックサム検証とみられる、ハングではなく単に
  314GBファイルの検証コスト)。
- lineage転送: 204.6MB、数十秒。
- stars側`pmtiles verify`: elevation 2.16秒・lineage 288ms、
  いずれもクリーン。
- アトミックリネーム・`systemctl --user restart martin`実行、
  14:43:15にmartin再起動確認。

### 実地確認

公開URL(`https://stars.optgeo.org/`)経由で直接確認:

| 座標/エンドポイント | 結果 |
|---|---|
| elevation z13/6894/3521(与那国) | HTTP 200、64,276 bytes——D118/D122の検証値と完全一致 |
| elevation z8/219/101(対馬・五島) | HTTP 200、225,036 bytes——同上、完全一致 |
| elevation TileJSON | `minzoom:0`/`maxzoom:16`/bounds全球/center(140.9,41.85,12)——正常 |
| lineage TileJSON(`mapterhorn-japan-bridge-lineage`、初回公開) | HTTP 200、`minzoom:8`/`maxzoom:16`/bounds日本域——正常 |
| lineage z8/219/101 | HTTP 200、490 bytes |

既知座標のバイト数が1号の検証済み値と完全一致——パイプライン刷新
(D107の名前空間分離、D124のgeneration_id階層化等)による回帰が
一切ないことを実地で裏付けた。

### 現在の状態

**1.5号(`01M1MKD73P0KDT719H21NJV9VR`)、ミッションコンプリート。**
elevation・lineageともstarsで公開・稼働中。1号のデータには最後まで
一切触れていない(D124のgeneration_id必須化が設計通り機能した)。

D96で構想された1.5号の二重目的——(1)D95の名前空間分離を全国
スケールで初めて検証、(2)lineageタイル機能の実装・検証・公開——
両方とも達成された。

### 残タスク

- ダッシュボード(`mapterhorn-monitor`)を「1.5号 公開完了・ライブ」
  状態に更新
- lineageのダッシュボード組み込み方法をHidenoriさんと改めて相談
  (公開完了後に、との合意)
- stars-cdとのディスク容量問題(Source Cooperative移設案)の
  相談は継続中、返信待ち
- 2号は新しいセッションで着手(このセッションでは行わない、
  Hidenoriさんとの合意)

### Resume prompt

> D145: 1.5号(`01M1MKD73P0KDT719H21NJV9VR`)がstarsへの公開を完了
> (2026-09-06 14:43 JST)。elevation(314.66GB)・lineage(204.6MB、
> 初回公開)ともstars側verify OK、実地確認(既知座標のバイト数が
> D118/D122の検証値と完全一致)もクリーン。**1.5号はこれで
> ミッションコンプリート**——D96の二重目的(名前空間分離の全国検証、
> lineage機能の実装・公開)を両方達成。1号データは最後まで無傷。
> **次のアクション**: ダッシュボードを公開完了状態に更新、
> lineageのダッシュボード組み込み方法をHidenoriさんと相談、
> stars-cdからのディスク容量相談の返信待ち。2号は新セッションで
> 着手予定(このセッションの主要ミッションはここで完了)。


## D146: lineageの低ズーム拡張(z8→z4)。elevationには一切触れず、専用スクリプトで安全に実施

**Status**: Recorded, 2026-09-06 19:45 JST頃。

### 背景

Hidenoriさんから「lineageタイルを、日本全体の傾向がわかるよう、もう少し
低いminzoomまでダウンサンプリングを進められるか」との要望。

`downsampling_covering.py`の`write_downsampling_items()`が持つ
`min_output_zoom=8`という下限は、実はelevation固有の事情——自前の
z0-7ピラミッドには深海部の構造的な欠損があり、Mapterhorn本家の
グローバルz0-7成果物を`pmtiles merge`で丸ごと接合する設計のため、
自前生成をz8で止めている(コード内コメント参照)。lineageには
接合対象となる外部のグローバル成果物が存在しない(D96で
「lineageは最初から最後までJapan-only」と設計済み)ため、この下限は
lineageには本来当てはまらない。

### 実装上の注意——共有コードには触れない

`write_downsampling_items()`のcovering CSV生成はdatatype非依存
(elevation・lineage共有)で、`downsampling_run.py`はaggregation-store
配下の`*-downsampling.csv`を機械的に全部処理する。単純に
`min_output_zoom`を下げて再実行すると、**elevation側もz4-z7の
不要な再構築に巻き込まれる**(314GBの本番アーカイブには一切触れない
という方針に反する)。

この危険を避けるため、既存の公開済みz8レイヤー(読み取りのみ)を
入力とする独立スクリプト`hfu-mapterhorn/pipelines/lineage_extend_low_zoom.py`
を新規作成した。`downsampling_covering.py`/`downsampling_run.py`は
一切変更していない。z8→z7→z6→z5→z4の4段を、`lineage_downsample.
majority_vote_downsample()`(既存・自己テスト済み)を再利用して
順次構築し、`get_pmtiles_folder()`の既存のz<7フラットバケット命名
規則(`{extent}-{output_zoom}.pmtiles`)に沿って出力するため、
`bundle.py`側のコード変更は不要だった。

### 実装中に発見・修正した実バグ

初版のスクリプトは、自分自身が書いた出力ファイル(`0-0-0-{zoom}.
pmtiles`、Japan全体を単一の仮想z0エクステントとして命名)を次段の
入力として再度glob+ファイル名解析で読み込んでいたが、
`get_tile_to_pmtiles_filename()`はファイル名のエクステントタイル
(z0/x0/y0)から`mercantile.children()`で子タイル集合を機械的に
導出する仕組みのため、「z0/0/0の全子孫」=**地球全体**(z7で16,384
タイル)を対象と誤認識してしまった。実際には68個の実タイルしか
存在しないにもかかわらず、大半がnodataの偽タイルを地球全体に
量産する形になっていた(z6で4,096個生成、うち実質日本分は17個)。

z6/z5/z4の3ファイルを削除し、各段で実際に構築したタイル集合を
Python側で明示的に次段へ引き渡す設計に修正して再実行——結果は
z7:68→z6:17→z5:10→z4:6タイルという妥当な数に。z4/13/6タイルの
デコード確認でも、カテゴリ0(1m)/1(5mA)/2(5mB)/3(5mC)/5(10mB)/6
(海)の混在が本土相当の位置に正しく現れていることを確認した。

### 再ビルド・再公開

lineageだけを対象に、既存のパイプラインコードをそのまま再利用:

1. `BUNDLE_DATATYPE=lineage python3 bundle.py 1`(23ファイル生成、
   EXIT_CODE=0)
2. `MERGE_DATATYPE=lineage python3 merge_japan_bundles.py`(D144の
   自動`pmtiles cluster`込み、2,568,162タイル、EXIT_CODE=0)
3. `./pmtiles verify` — 61ms、クリーン。`./pmtiles show`:
   `min zoom: 4`(旧8から更新)、`max zoom: 16`、`clustered: true`。
   ファイルサイズ204.6MB(旧204.57MB、z4-7追加分はごくわずか)。
   `bounds`の南端がlat 0.0まで広がって見えるのは、z4/13/7タイルの
   グリッド境界が沖ノ鳥島近辺の少量の有効ピクセルを含むだけでも
   タイル全体の幾何境界としては赤道まで届くため——データ異常では
   ない(mercantile.bounds()で確認済み)。
4. `rsync`でstars側`/home/stars/data/mapterhorn-japan-bridge-lineage.
   pmtiles`を`.new`サフィックス経由でアトミックに置き換え(headroom
   149GB、ファイルが小さいためD142のような削除→転送の2段階は不要)、
   `systemctl --user restart martin`。
5. 公開URL(`https://stars.optgeo.org/mapterhorn-japan-bridge-lineage`)
   のTileJSONで`minzoom:4`を確認、`4/13/6`タイルもHTTP 200で取得
   できることを確認。

elevation側のアーカイブ・パイプラインコードには最後まで一切触れて
いない。

### 現在の状態

lineageアーカイブが日本全体の低ズーム傾向を含む形でstarsに公開
済み。ダッシュボード(`mapterhorn-monitor`)のLineage instrumentは
`minzoom:8`のまま(既存のズームレベル11前後の詳細ビューでは
影響なし)——低ズーム表示を活かすのは、Hidenoriさんが依頼した
もう一つの作業(独立GitHub Pagesサイト、globe view)の方が適切。

### 残タスク

- 独立リポジトリ(`hfu/japan-bridge-lineage`案)の新規作成:
  Vite + MapLibre GL JS v6系 + globe view + GitHub Pages(`docs/`)、
  今回拡張した低ズームlineageデータを活用
- stars-cdとのディスク容量問題(Source Cooperative移設案)の
  相談は継続中、返信待ち
- 2号は新しいセッションで着手(このセッションでは行わない)

### Resume prompt

> D146: lineageアーカイブの低ズーム拡張(z8→z4)完了・公開済み
> (2026-09-06 19:45 JST頃)。elevation固有の`min_output_zoom=8`の
> 理由(Mapterhorn本家グローバルz0-7の接合)はlineageには当てはまら
> ないため、新規独立スクリプト`lineage_extend_low_zoom.py`(既存の
> 共有パイプラインコードは無変更)でz7/z6/z5/z4を追加構築。実装中に
> 「地球全体を誤って対象にする」バグを発見・修正済み(修正後は
> z7:68→z6:17→z5:10→z4:6タイルという妥当な数)。lineageのみ再
> bundle→merge→cluster→verify→starsへ再公開、ライブ確認済み
> (`minzoom:4`、`4/13/6`タイルHTTP 200)。elevation・共有コードには
> 無傷。**次のアクション**: Hidenoriさんが依頼した独立リポジトリ
> (`hfu/japan-bridge-lineage`、Vite+MapLibre GL JS v6+globe view+
> GitHub Pages `docs/`)の新規作成に着手する。


## D147: JGD2011→JGD2024のCRS変更を調査——実データで実際に発生中と確認、ただしEPSGコード未発行のため今回は修正せず保留

**Status**: Investigated, decided to defer, 2026-09-07。**2026-09-09
追記: EPSGは新コードではなくEPSG:6668自体をリネームする形で決着
済み、下記「追記」参照——実質的に対応不要と判明。**

### 経緯

`PLAN.md`§1(2026-09-03)で、GSIの2025-04標高改定の副産物として
「座標参照系がJGD2011からJGD2024に変更された」ことが見つかり、2号
launch前の未検証項目として残っていた。今回、実コード・実データ・
最新のGDAL/PROJデータベースを直接確認して決着させた。

### 調査内容

**パイプライン側のコード確認**:
- GeoTIFFへのCRS書き込み元は`hfu-mapterhorn`ではなく、
  `japan-geotiff-dem`が`convert`ステージで呼ぶ外部Dockerツール
  `gmldem2tif`(`github.com/unopengis/gmldem2tif`、ローカルクローン
  `/Volumes/Migrate-2025-04/github/gmldem2tif`)。その`gmldem2tif.rb`は
  `EPSG_CODE = 6668`という定数を無条件に採用し(`set_projection()`)、
  GMLの`srsName`属性を一切読まずに全出力をJGD2011として焼き付ける。
- `hfu-mapterhorn/pipelines/aggregation_reproject.py`の`create_warp()`は
  `gdalwarp`に`-s_srs`を渡さず、入力GeoTIFFに埋め込まれたCRS
  (=常にEPSG:6668)をそのまま信頼して`-t_srs EPSG:3857`へワープする
  設計——つまり全体が「入力は常にEPSG:6668」という前提で一貫している。

**実データでの確認(仮説ではなく現在進行形の事実)**:
`japan-geotiff-dem-repo`の`src/1/`にある実ファイルのうち、mtimeが
2025-08-01以降(=GSIの2025-07-31改定より後にダウンロードされたもの)
の一つ、`FG-GML-473131-DEM1A-20260603.zip`を実際に展開して確認した
ところ、含まれる`FG-GML-4731-31-89-DEM1A-20260603.xml`
(ファイル名の日付自体は`-20250718`のものも含む——`PLAN.md`が既に
警告している通り、ファイル名日付は測量日であり再処理日ではない)の
`<gml:boundedBy><gml:Envelope srsName="fguuid:jgd2024.bl">`が
実際に`fguuid:jgd2024.bl`だった。**2号がこれから取り込む実データは、
既に現時点でこの状態になっている。**

**EPSGコードの現況(2026-09-07、このマシンの最新GDAL/PROJで直接確認)**:
- GDAL 3.13.3(2026-08-13リリース、直近)のPROJデータベースを
  `projinfo`で直接クエリした結果、**JGD2024にはEPSG権威のコードが
  まだ存在しない**。登録されているのはESRI権威のコードのみ
  (2次元地理座標系`ESRI:104221`「JGD_2024」、3次元`ESRI:104220`
  「JGD_2024_3D」、平面直角座標系19系・UTM各ゾーン・標高系も同様に
  ESRI権威)。ネット記事で見た「EPSG Dataset v12.055(2026-04)で
  登録済み」という情報は、少なくともこの最新PROJデータベースには
  反映されていない。
- `projinfo -s EPSG:6668 -t ESRI:104221`は`ESRI:108386,
  "JGD_2011_To_JGD_2024_1", 1.0 m`という**明示的な変換**を返した——
  恒等変換(null transform)としては登録されておらず、PROJ自身の
  モデルでは「厳密に同一ではない、公称精度1.0mの変換」として扱われて
  いる。
- 同じ問題はGDAL本体も先に踏んでいた: `OSGeo/gdal` issue #12897
  (2025-08-09、`fguuid:jgd2024.bl`をGDALのGMLドライバが認識できず
  軸順序を誤る)→ PR #12918(2025-08-26マージ)で、GSI公式基盤地図
  情報ダウンロードデータ仕様書v5.2 p.46で定義された識別子と判明。
  当時EPSGコードが存在しなかったため、GDALは`DATUM["Japanese
  Geodetic Datum 2024",...]`を持つ独自WKTを`// FIXME when EPSG
  attributes a CRS code`というコメント付きで手で組み立てて暫定
  対応した。GDALの現在のPROJデータベース(3.13.3時点)がその後
  ESRI権威コードに移行済みなのは確認したが、EPSGコード自体は
  まだ発行されていない。

### Hidenoriさんとの判断

「基本、日本ローカルの話ではあるが、直すべきものであることは間違い
ない」という前提のもと検討したが、「fguuid:jgd2024.blのような特殊
コードを使う必要はなく、EPSGコードで普通に表現できる範囲のはず」
という見立てを持っていた。上記調査の結果、その見立ては現時点では
外れている(EPSGコード自体がまだ存在しない)ことが分かったため、
Hidenoriさんの判断で**今回は`gmldem2tif.rb`を修正せず、EPSGが正式
コードを発行するのを待つ**こととした。ESRI:104221を暫定採用する
案、GDALと同様の手組みWKTを埋め込む案は、いずれも今回は見送り。

### 結論・今後

- `gmldem2tif.rb`は当面`EPSG:6668`固定のまま——2号launchの
  ブロッカーにはしない(Hidenoriさんの評価: 致命的ではない)。
- **定期的にEPSG登録状況を再確認すること**(次に確認するタイミング:
  2号launch直前、または`projinfo JGD2024`のID行が`ESRI`から`EPSG`に
  変わったことに気づいた時)。EPSGコードが発行されたら、
  `gmldem2tif.rb`の`srsName`読み取り対応(jgd2011.bl→EPSG:6668、
  jgd2024.bl→新EPSGコード)を実施する。
- 参考までに、この調査結果(実データでの`fguuid:jgd2024.bl`確認、
  EPSGコード未発行の現況)はOSGeo/gdal issue #12897や、Mapterhorn
  メンテナのOliver Wipfliにとっても有用な情報である可能性が高い——
  upstream`jpdem1a`が独自にGSIのGMLを取り込んでいるなら同じ問題を
  抱えている可能性がある。共有するかどうかは別途Hidenoriさんと相談。

### 追記(2026-09-09): EPSGはリネームで決着済み——実質「6668のままでいい」

Hidenoriさんの「6668のままでいいと国土地理院自身が言っていないか」
という問いをきっかけに再調査した。

**一次情報での確認**: PROJ本体(`OSGeo/PROJ`)の[コミット
`7f1fdb39`](https://github.com/OSGeo/PROJ/commit/7f1fdb39)
(2026-04-22、EPSG Dataset v12.055反映)のコミットメッセージに
`rename JGD2011 to JGD2024... sigh` と明記されている。つまりEPSGは
**新規コードを発行したのではなく、既存のEPSG:6668自体の名前を
「JGD2011」から「JGD2024」へリネームする形で決着させた**——番号は
変わっていない。標高・複合座標系側では新規コード(EPSG:11317ほか、
13〜19系の複合CRSでEPSG:11319-11445)が追加されたが、これは今回の
用途(2次元水平位置のみを扱うDEM1Aのreprojection)には無関係。

国土地理院自身の公式ページ(gsi.go.jp/sokuchikijun/datum-main.html)
も「測地系の定義を変更するものではなく...緯度経度や平面直角座標の
数値は日本測地系2011から引き継いでいます」と明記しており、2次元の
水平位置は数値として完全に不変——EPSG側の対応(リネームのみ、番号
維持)と整合している。

**このマシンでまだ見えない理由**: このマシンのGDAL 3.13.3付属PROJ
(`/opt/homebrew/Cellar/proj/9.8.1/share/proj/proj.db`)はEPSG
v12.029(2025-10-02付)のままで、v12.055(2026-04)を未取り込み——
`projinfo EPSG:6668`が今もローカルでは「JGD2011」という名前を返すのは
単なるツールの更新遅れであり、EPSGレジストリ本体は既にリネーム済み。
2026-09-07時点の調査(このエントリの本文)がPROJのローカルDBを
「最新」と誤認していたのが、今回の見落としの直接原因。

**結論**: `gmldem2tif.rb`が`EPSG:6668`を焼き付け続ける現在の挙動は
**最初から実質的に正しかった**——番号が変わらない以上、待つべき
「新しいEPSGコード」は存在しない。今後ローカルのPROJが更新されて
`projinfo EPSG:6668`の名前表示が「JGD2024」に変わったとしても、
コード側の対応は不要(同じ番号を使い続けるだけでよい)。強いて言えば
出力メタデータの表示名(WKTの`DATUM["Japanese Geodetic Datum
2011",...]`という文字列)が今後リネームされる可能性はあるが、これは
数値・投影結果に影響しない表示上の話であり、`aggregation_reproject.py`
側の対応は不要と判断する。

### Resume prompt

> D147: JGD2011→JGD2024のCRS変更を調査。2026-09-07時点では「実データは
> 既に`fguuid:jgd2024.bl`だが、EPSGコードがまだ存在しない」と判断し
> 修正を保留したが、**2026-09-09の追記でこの判断は実質的に解消**——
> PROJ本体のコミット`7f1fdb39`(2026-04-22、EPSG v12.055)により、
> EPSGは新規コードではなく**EPSG:6668自体を「JGD2011」から
> 「JGD2024」へリネーム**する形で決着させたことが判明(番号は不変)。
> 国土地理院自身も水平位置の数値はJGD2011から不変と明記しており整合。
> このマシンのPROJ(v12.029、2025-10)がまだこのリネームを未取り込み
> なのが2026-09-07調査の見落とし原因だった。**結論:
> `gmldem2tif.rb`のEPSG:6668固定は最初から実質的に正しく、対応不要**。
> **次のアクション**: 特になし、この項目はクローズ扱いでよい。Oliver
> Wipfliへの共有は、返信メッセージに「6668に固定したままで問題ない」
> という実態を反映させる形で行う。残る2号readiness項目(5m/10m破損
> バグテスト、D57 dirty-tracking判断)へ進む。


## D148: downsampling丸め忘れバグをupstreamから移植(Oliver Wipfli提供)。1.5号elevationを再生成してstars容量を削減

**Status**: Accepted, 実装・再生成実施中、2026-09-07。

### 経緯

Hidenoriさんから、Oliver Wipfliが upstream `mapterhorn/mapterhorn` に
入れた改善のシェアを受けた:「downsamplingで丸め処理をしていなかった
バグを直した、タイル容量の削減になるかもしれない」。実際に
upstream一覧を確認したところ、`53e4d3d`「Fix rounding on downsampling
bug (#308)」(Oliver Wipfli、2026-09-05)が該当。

### upstreamの修正内容

`downsampling_run.py`の`create_tile()`が4x4ピクセル平均を取った後、
その場のズームに応じたTerrarium垂直分解能へ丸める処理
(`utils.get_rounded_elevation_data()`、`save_terrarium_tile()`が
aggregation側では元々やっていたのと同じ処理)を一切していなかった。
平均後の浮動小数点ノイズは実質的な情報を持たない(元データは既に
子ズームの分解能で量子化済み)にもかかわらず、WebPロスレス圧縮の
予測符号化を阻害していた。

### 自リポジトリへの移植

`hfu-mapterhorn`の`downsampling_run.py`はD56以降upstreamから分岐して
おり(`FORK_NOTES.md`)、elevation平均化部分もアルファ重み付け・
単一スカラーからRGB再導出という独自実装(D114(B)関連の書き直し)の
ため、単純マージ不可。`utils.get_rounded_elevation_data()`を新設
(upstreamと同じ32m上限キャップ込み)し、`save_terrarium_tile()`と
`downsampling_run.py`の両方から呼ぶよう移植した
(`hfu-mapterhorn`コミット`e634881`)。lineageの多数決downsampling
(D93/D94)は別コードパスのため無関係。

### 実測(1.5号の実データ400タイルで検証)

再ダウンロード済みの1.5号downsampling出力(elevation、
`01M1MKD73P0KDT719H21NJV9VR`)からランダムに400タイルを抽出し、
丸め処理あり/なしで再エンコードしたサイズを比較:
**43.0MB → 9.2MB(78.7%削減)**。ただしこれはdownsampling層タイルの
みの数値——aggregation層(元々丸め済み)を含む最終アーカイブ全体の
削減率はこれより小さくなる。

### 1.5号への適用判断

Hidenoriさんの判断で、既に公開済みの1.5号elevationアーカイブ
(314.66GB、stars)も再生成することにした。starsのディスク空き容量が
149GB(92%使用)と逼迫している事情(stars-cdとの相談継続中)も
後押しした。

**手順**: `01M1MKD73P0KDT719H21NJV9VR`のelevation用
`*-downsampling.done`マーカー8,223件のみ削除(lineageの
`*-downsampling.lineage.done`は無傷)→ downsampling再実行 →
bundle → merge(D144のcluster込み)→ z0-7 global-overview再接合 →
verify → stars側旧ファイル削除→新ファイル転送(D142/D145と同じ
delete-then-transferパターン、この間elevationタイル配信は一時停止、
lineageは無影響)。推定新アーカイブサイズ約225〜235GB
(現314.66GBから約25〜30%減)。

このセッション時点でdownsampling再実行が進行中(screen
`downsample_round_fix`)。bundle以降・stars公開は別途完了を待って
実施。

### Resume prompt

> D148: Oliver Wipfliが見つけたupstream `mapterhorn/mapterhorn`の
> downsampling丸め忘れバグ(`53e4d3d`)を`hfu-mapterhorn`に移植
> (`utils.get_rounded_elevation_data()`新設、コミット`e634881`)。
> 実データ400タイルで実測78.7%削減(downsampling層のみ)。starsの
> ディスク逼迫(149GB空き)もあり、Hidenoriさんの判断で1.5号
> elevationアーカイブ(314.66GB)を再生成することに決定、downsampling
> 再実行を screen `downsample_round_fix` で開始済み(lineageの
> `.done`は無傷)。**次のアクション**: downsampling完走を待ち、
> `BUNDLE_DATATYPE=elevation bundle.py` → `MERGE_DATATYPE=elevation
> merge_japan_bundles.py` → `pmtiles merge`でz0-7再接合 → verify →
> stars側旧ファイル削除→新ファイル転送(要事前確認)。


## D149: 「1.6号」——陸域maxzoom不整合(離島の穴・lineageの誤tier表示)への対応設計に合意。実装は小規模リハーサル後

**Status**: Design agreed, 実装前, 2026-09-07。

### 発端

Hidenoriさんから2点の指摘:
1. lineageで、タイルが存在しない/未読み込みの箇所が**tier 0(1m)の色で
   表示される**——データなしなのにあたかも1mデータがあるかのように
   見える。
2. elevationで、離島(特に1mデータがまだ整備されていない島)の近くや
   内部でタイルが欠けておかしな挙動になる箇所がある。maxzoomが
   足りていないのではないか。「一番細かいmaxzoomまで、5m/10mしか
   ないエリアもアップサンプルできないか」という提案。

### 調査で判明した事実

**両者は同一の根本原因**: `aggregation_covering.py`/`aggregation_
reproject.py`は各アイテムの実際のソース解像度(1m/5m/10m)に応じて
maxzoomを決める設計のため、1mが無いエリアは深いズームで単純に
タイルが存在しない。

- **規模の実測**: 1.5号の陸域aggregationアイテム4,133件中2,128件
  (約51%)がz16(1m相当)に届かず、z13/z14止まり——「一部の離島だけ」
  という当初の想定より広い。
- **サーバー挙動の実測**: martinは欠落タイルに404ではなく**HTTP 204**
  を返す(与那国島周辺の実座標で確認、z13=200/52bytes、
  z14〜z16=204/0bytes)。
- **MapLibre本体のソースコードを直接確認**: `draw_color_relief.ts`は
  `if (!dem?.data) continue;`でDEM無しタイルの描画を正しくスキップ
  する実装を持つが、この修正(PR #8207/upstream issue #1551)は
  **2026-09-03——4日前**にmainへ入ったばかりで、どのリリースにも
  未収録。現在ピン留め中の`maplibre-gl 5.24.0`(2026-04-23リリース)
  はこの5ヶ月前で、旧い(祖先タイルへのフォールバックが無く、
  不完全なDEMをそのまま描画しようとする)コードパスのまま。6.x系は
  別のraster-dem読み込みバグを抱えており今は乗り換えられない。
  **結論: クライアント側の設定だけでは今は解決できない**——タイルの
  実在ギャップ自体をパイプライン側で埋める必要がある。

### 設計方針(Hidenoriさんの提案どおり、通称「1.6号」)

- **対象は陸域のみ**——`jpnationalsea`単独のアイテム(海)は対象外。
  海底に1m級の詳細を持たせても無価値でコストだけ増える。
- **目標maxzoom: z16**(現行1m/DEM1Aティアの到達点)。
- **変更箇所3段階**:
  - `aggregation_covering.py`: アイテム粒度をmaxzoom-extent差(上限6)
    で決めている箇所を、陸域は実maxzoomでなく目標z16基準に変更
    (さもないと5m/10mエリアのアイテムがz16分の面積を保持できずメモリ
    上限超過)。
  - `aggregation_reproject.py`の`reproject()`: `zoom =
    grouped_source_items[0][0]['maxzoom']`を陸域は`zoom = 16`固定に
    変更。`gdalwarp -r cubicspline`は元々アップサンプルに対応済みで
    warp自体の追加実装は不要。
  - `downsampling_covering.py`: 変更不要と想定(aggregation出力の
    ファイル名から実際のchild_zoomを機械的に拾う設計のため、
    aggregation側が深く出力すれば自動的に反映されるはず——要検証)。
- **lineageの正しさ**: アップサンプルしたピクセルも
  `lineage_provenance.py`のグループ優先順位ロジックがそのまま動く
  ため、元のtier(5m/10mなど)を正しく報告し続ける設計にできる——
  「1mのふりをする」ことにはならない。

### コスト見積もり(未実測、要リハーサル)

陸域6,373アイテム中2,128件(51%)が対象。z14→z16は1辺4倍(面積16倍)、
z13→z16は1辺8倍(面積64倍)のピクセル増。D148の実測(丸め処理による
78.7%圧縮改善)から類推すると、滑らかな補間データはWebP圧縮が
非常に効くため**ファイルサイズの増加は面積ほど劇的ではない可能性が
高い**。一方`aggregation_run.py`/`downsampling_run.py`の**処理時間**は
素直にピクセル数に比例して増える見込みで、こちらは楽観できない——
2号の「コード変更不要」という設計方針とは別スコープの変更であり、
2号に直接組み込むのではなく独立した取り組みとして扱う。

### 合意事項

Hidenoriさん: 「そうね。いわゆる1.6号を実行する必要は認める。
DECISIONSに記録してからリハーサルなどを進めて良い」——1.6号として
進める方針に合意。ただし**実装はまだ**——次のアクションは小規模
リハーサル(1アイテムのみ、例えば今回調査に使った与那国島周辺の
z13止まりアイテム)で実際の処理時間・出力サイズを実測してから、
2,128件全体への展開規模を判断する。

### Resume prompt

> D149: Hidenoriさんの2指摘(lineageのNODATA→1m誤表示、離島elevation
> の欠落)を調査、**同一の根本原因**と判明——陸域aggregationアイテム
> 4,133件中2,128件(51%)がz16(1m)に届かずz13/z14止まり。MapLibre
> 本体のソースを直接確認し、欠落タイルへの祖先タイルフォールバックは
> 現行ピン留め版(5.24.0、2026-04)には無く、該当修正(PR #8207)は
> 2026-09-03にmainへ入ったばかりでまだリリース未収録——クライアント
> 側だけでは今は直せないと結論。Hidenoriさんの提案「5m/10mのみの
> 陸域もz16までアップサンプル」に、通称**「1.6号」**として合意
> (2号とは別スコープ、2号のコード不変更方針を守る)。設計は
> `aggregation_covering.py`(粒度)/`aggregation_reproject.py`
> (warp解像度)の2箇所が主、`downsampling_covering.py`は変更不要と
> 想定(未検証)。**次のアクション**: 実装前に、与那国島周辺など
> z13止まりの1アイテムで小規模リハーサルを行い、実際の処理時間・
> 出力サイズを実測してから展開規模を判断する。D148(downsampling
> 丸め処理修正・1.5号再生成)は並行進行中、完了を妨げない。


## D150: 1.6号の単一アイテムリハーサル完了。仕組みは動作確認、ただし本番投入前に必須の実装バグを1件発見

**Status**: Rehearsal complete, 実装は未着手, 2026-09-07。

### リハーサル環境

D124の手法(`pipelines-rehearsal/`)を踏襲し、`pipelines-rehearsal-16go/`
を新規構築: 大半のスクリプトは本番`pipelines/`へのシンボリックリンク、
`aggregation_reproject.py`のみ実験用にコピー(`UPSAMPLE_TARGET_ZOOM`
環境変数でwarp先ズームを強制上書きできるよう最小限の変更)、
`source-store`は本番を読み取り専用共有、`pmtiles-store`は使い捨ての
`/Volumes/pmtiles-store/rehearsal-16go-store`。使い捨て世代
`00TESTREHEARSAL16GOUPSAMPLE1`。

対象アイテムは実際の1.5号アイテム`11-1727-881-13`
(与那国島周辺、DEM10B[10m]のみ+海フォールバック、native maxzoom=13)
のレシピをそのまま流用。`UPSAMPLE_TARGET_ZOOM=16`でreproject→
lineage provenance→merge→tileの実コードチェーンを実行(本番の
`aggregation_run.py`の`run()`と同じ呼び出し順序)。

### 実測結果

- **所要時間**: reproject 26.5s + lineage provenance 2.4s + merge 29.2s
  + tile 27.6s = **合計85.7秒**(z13→z16、3ズーム分のアップサンプル)。
- **出力**: 13,943,520 bytes(13.9MB)、1,024アドレス化タイル
  (32×32、z16)、tile entries 224・tile contents 202(海・nodataの
  自然な重複により既にある程度圧縮)。
- **標高値の健全性**: 32×32グリッド全体をデコードして確認、実際に
  陸地がある領域(dx19-27, dy7-15付近)で0〜312m程度のなだらかな
  勾配を確認——補間による異常値・破損は見られない。与那国島の
  最高地点(宇良部岳、約231m)と整合的な範囲。

### 本番投入前に必須と判明した追加の実装バグ

**`aggregation_tile.py`の`main()`が出力する外側のpmtilesアーカイブ
ファイル名に、ファイル名由来の(stale・native)child_zをそのまま
使っている**ことが実機で確認できた: 今回の出力は
`11-1727-881-13.pmtiles`という名前のまま、中身は実際には
`min_zoom:16`/`max_zoom:16`の1,024タイルだった。`create_tiles()`
内部は実ラスタの寸法から正しくchild_zを再計算している
(`aggregation_tile.py`3.5節相当の設計通り)一方、`main()`の
`out_filepath`組み立てはこの再計算結果を使わず、ファイル名パースの
`child_z`(13のまま)を使っている——これは**D149の設計表に無かった、
リハーサルで初めて見つかった4箇所目の変更点**。ファイル名と中身が
食い違うと、`downsampling_covering.py`がこのアイテムの「実際に
存在する最も深いズーム」を13だと誤認し、z14/z15/z16のdownsampling
覆いを正しく組めない(存在しないz13リーフを参照しようとする)
おそれがある——本番投入前に必ず修正が必要。

### コスト見積もりの更新(実測ベース)

1アイテムあたり約86秒(z13→z16、3ズーム分)。対象2,128件のうち
1,564件がz13→z16(3ズーム)、564件がz14→z16(2ズーム、これより
軽いと推測されるが未実測)。仮に平均70秒/件とすると、
2,128件 × 70秒 ≈ **約41時間の追加処理時間**——1.5号のaggregation
ステージ全体(6,373件、約15時間)と比べてかなり大きい追加コストで、
2号に直接組み込むべきではないという既存の判断を裏付ける。ファイル
サイズは13.9MB/アイテムで、面積64倍のわりには圧縮が効いている
(D148の丸め処理での知見と同種の効果)。

### 現在の状態

`pipelines-rehearsal-16go/`はHidenoriさんの確認用に残置(D124の
前例と同じ扱い、不要になれば削除してよい)。本番コードには一切
触れていない。**実装(`aggregation_tile.py`のファイル名バグ修正、
`aggregation_covering.py`のアイテム粒度対応)はまだ着手していない**。

### Resume prompt

> D150: 1.6号(陸域maxzoomアップサンプル)の単一アイテムリハーサル
> 完了。`pipelines-rehearsal-16go/`(D124方式、本番コードはシンボリック
> リンク、`aggregation_reproject.py`のみ実験用コピー)で、与那国島
> 周辺の実アイテム(`11-1727-881-13`、DEM10B10mのみ、native
> maxzoom=13)をz16まで実際にアップサンプル。結果: 86秒/アイテム、
> 13.9MB、1,024タイル(z16)、標高値は0〜312mでなだらか・健全
> (与那国島最高地点231mと整合)。**本番投入前に必須の追加バグを
> 発見**——`aggregation_tile.py`の`main()`が出力pmtilesファイル名に
> stale(native)child_zを使っており、実際の中身(z16)と食い違う
> ——`downsampling_covering.py`がこのズレを正しく扱えるか要検証・
> 修正必須(D149の設計表に無かった4箇所目)。コスト見積もりを実測
> ベースに更新: 対象2,128件全体で約41時間の追加処理時間——2号への
> 直接組み込みを避ける既存判断を裏付ける。**次のアクション**:
> `aggregation_tile.py`のファイル名バグを直し、複数アイテムの
> チェーン化リハーサル(D124と同じ隣接2件パターン)で
> downsampling_covering.pyとの整合性を検証してから、Hidenoriさんに
> 本実装・展開の可否を確認する。まだ本番コードは無変更。


## D151: `aggregation_tile.py`/`lineage_tile.py`のファイル名バグを本番修正・検証済み。チェーン化リハーサルで`downsampling_covering.py`にも必須の追加修正が判明(サイレントなタイル欠落リスク)

**Status**: `aggregation_tile.py`/`lineage_tile.py`は修正・本番commit可能な状態。`downsampling_covering.py`は未修正・設計要。2026-09-07。

### `aggregation_tile.py`/`lineage_tile.py`の修正

D150で見つかった「出力pmtilesファイル名がstale(native)child_zのまま」
というバグを本番コード(`hfu-mapterhorn/pipelines/aggregation_tile.py`・
`lineage_tile.py`)に直接修正した。`create_tiles()`/`create_lineage_
tiles()`が実ラスタ寸法から計算する child_z を`return`するよう変更し、
`main()`側はファイル名パース値ではなくその戻り値でアーカイブ名を
組み立てるよう変更。**通常運用(アップサンプルなし)ではこの2値は
常に一致するため、既存の1号・1.5号の挙動に対して完全に無害な変更**
——1.6号のための準備として先行commitして問題ない。

### チェーン化リハーサルで判明した追加の必須修正

D124と同じ隣接2アイテムパターン(`11-1727-881-13`+隣接`11-1728-881-13`、
共にDEM10Bのみ、native maxzoom=13)で、修正後のコードを使い
aggregation(elevation+lineage)→`downsampling_covering.py`のチェーンを
実行。aggregation側は正しくz16(`...-16.pmtiles`、1,024タイル×2)を
生成したが、**`downsampling_covering.py`がこの深いズームを一切
検出しなかった**:

```
child_zoom=16
get extents...
（何も見つからない、以下15/14でも同様）
...
child_zoom=13
get extents...
get tile to extent map...
```
child_zoom=13で初めて処理が始まった——native(旧)の値のまま。

**原因**: `write_downsampling_items()`内の`get_extents_from_coverings()`
が`aggregation-store/{aggregation_id}/*-*-*-{zoom}-*.csv`という
グロブパターンで「そのズームに存在するアイテム」を判定している。
このパターンがマッチするのは**aggregation covering CSVのファイル名**
(`{z}-{x}-{y}-{child_z}-aggregation.csv`、child_zは計画上のnative
maxzoom=13のまま)であり、pmtiles-storeの実際の出力ファイル
(D151の修正で正しくchild_z=16に直った側)は一切参照していない。
つまり**アップサンプルされたz14〜z16のリーフタイルは、
downsampling_covering.pyの視点からは「存在しない」ことになり、
z8までのピラミッド構築から永久に除外される**——クラッシュではなく
サイレントなデータ欠落になるという点で、D150の命名バグより
質の悪い問題。

### 設計上の含意

covering CSVのファイル名(計画上のchild_z)は、ソースのレシピを
特定する識別子として`.done`追跡・dirty検出(`get_dirty_aggregation_
filenames`等)に使われ続ける必要がある一方、downsampling covering は
**実際にpmtiles-storeへ書かれた深さ**を別途知る必要がある——この
2つの情報を1つのファイル名に押し込めてきた既存設計が、アップサンプル
導入によって初めて破綻する。修正の方向性(未設計、要検討):
`get_extents_from_coverings()`を`aggregation-store`のCSVではなく
`pmtiles-store/aggregation/elevation/{generation_id}/**/*.pmtiles`の
実ファイル名を直接スキャンする方式に置き換える、が最有力候補
——D150修正後はそのファイル名が常に正しいchild_zを持つため。

### 現在の状態

- `aggregation_tile.py`/`lineage_tile.py`の修正: commit可能、
  無害であることを確認済み。
- `downsampling_covering.py`の修正: **未着手・未設計**。1.6号は
  この設計が固まるまで本番投入不可。
- `pipelines-rehearsal-16go/`はHidenoriさんの確認用に残置(デバッグ
  用print文が`aggregation_reproject.py`の実験用コピーに残ったまま
  ——本番コードには影響しないため急ぎのクリーンアップ不要)。
- **副産物の発見**: `uv run --no-sync --project ../pipelines python3
  script.py`という素朴なスクリプト直接起動だと、`multiprocessing.
  Pool`(spawn方式)のワーカー内`print()`が呼び出し元に一切届かない
  という、この環境固有と見られる癖を発見した。`python3 -c "import
  script; script.main()"`という起動方法に変えると正しく届く
  ——原因はspawnのブートストラップ再実行の挙動差と推測されるが
  深追いはしていない。**今後このマシンでPoolベースのスクリプトを
  デバッグする際、workerのprintが見えない場合はこの起動方法の違いを
  疑うこと**(D148の`downsample_round_fix`screenセッションはこの
  問題を踏んでいない——`downsampling_run.py`は素朴なスクリプト起動
  だが、そちらは正常に進捗ログが出ている。原因は完全には特定できて
  いない)。

### Resume prompt

> D151: `aggregation_tile.py`/`lineage_tile.py`のファイル名バグ
> (D150で発見)を本番修正——通常運用には無害、commit可能。ただし
> D124方式のチェーン化リハーサル(隣接2アイテム、`11-1727-881-13`+
> `11-1728-881-13`)で**さらに重大な追加バグを発見**:
> `downsampling_covering.py`の`get_extents_from_coverings()`が
> `aggregation-store`のcovering CSVファイル名(計画上のnative
> child_z、アップサンプル後も13のまま)からズームを判定しており、
> pmtiles-storeの実出力(D151修正後は正しくz16)を一切見ない——
> アップサンプルしたz14〜z16のリーフが**サイレントに**downsampling
> ピラミッドから漏れる。クラッシュしない分、D150の命名バグより
> 気づきにくい。修正方針(未設計): `get_extents_from_coverings()`を
> pmtiles-store実ファイルの直接スキャンに置き換える案が有力。
> **1.6号はこの設計が固まるまで本番投入不可**。副産物として、この
> マシンで`uv run python3 script.py`(直接起動)だとmultiprocessing
> Poolワーカーのprintが消える環境固有の癖も発見(`python3 -c
> "import script; script.main()"`なら正常)——今後のデバッグで注意。
> **次のアクション**: Hidenoriさんの指示通り、1.6号はここで一旦
> 区切り、1.5号以降(D93〜D151)の包括的コードレビューへ移る。


## D152: 包括的コードレビューで発覚した「公開中lineage低ズームデータが実データの13%しか読んでいない」バグを修正・再生成完了

**Status**: 修正・再生成・merge完了。stars公開は未実施(要確認)、2026-09-08。

### 発覚の経緯

D148(Oliverの丸め処理修正)の1.5号elevation再生成が完了したのを機に、
Hidenoriさんの指示で1.5号以降(D93〜D151、実質的にはD146〜D151の
5コミット)のコードレビューを実施(`/code-review` skill、high effort、
9並列エージェント)。最重要所見として、`lineage_extend_low_zoom.py`
(D146)のz8アーカイブ検出globが**非再帰的**であることが判明した。

### バグの実態

`utils.get_pmtiles_folder()`はz≥7のextentタイルを`{FOLDER}/{z7bucket}/`
サブフォルダに格納する規則を持つが、`lineage_extend_low_zoom.py`の
`pattern = f'{FOLDER}/*-{source_output_zoom}.pmtiles'`は非再帰的だった。
実データで確認したところ、**z8アーカイブ全107件中、フラットに
存在するのはわずか14件(13%)**——残り93件(87%)はz7バケット配下に
あり、スクリプトからは不可視だった。「whole-globe」異常検知
(`SANE_TILE_COUNT_CEILING=5000`)は桁違いの膨張(16,384件)しか
検知できない設計だったため、この13%規模の欠落は素通りしていた。

**影響**: D146で公開・現在stars上でライブの
`mapterhorn-japan-bridge-lineage.pmtiles`のz4-z7部分は、日本全体の
うちごく一部(実データの13%相当の範囲)からしか構築されていない
可能性が高い——「日本全体の低ズーム傾向を示す」というD146の目的を
実質的に達成できていなかった。

### 修正内容

`hfu-mapterhorn/pipelines/lineage_extend_low_zoom.py`の`build_level()`:
- globを`f'{FOLDER}/**/*-{source_output_zoom}.pmtiles'`
  (`recursive=True`)に変更。
- `get_tile_to_pmtiles_filename()`は`{z}-{x}-{y}-{child_zoom}.pmtiles`
  という裸のbasenameしかパースできない(パス区切りを含むと
  `int()`変換で壊れる)ため、basenameのみを渡しつつ、
  `basename→相対パス`のマッピングを別途保持し、実ファイルアクセス時に
  そのマッピングで正しいネストパスへ解決する方式にした
  (`bundle.py`の`get_parent_to_filepaths()`が`*.pmtiles`と
  `*/*.pmtiles`の両方をglobしているのと同種の対応)。

修正後、実データで発見フェーズを検証: **107件全アーカイブを正しく
検出、実z8タイル数は440件**(旧版は14件のアーカイブからしか
導出できていなかった)。フラット・ネスト両方のパス解決が実ファイルの
存在確認で正しく機能することも確認済み。

### 再生成・merge結果

`lineage_extend_low_zoom.py`を実行(所要5.2秒):

| ズーム | 旧(バグ版、D146) | 新(修正後) |
|---|---|---|
| z7 | 68 | **117** |
| z6 | 17 | **37** |
| z5 | 10 | **13** |
| z4 | 6 | 6(同数) |

z7/z6/z5で大幅増——実データがより広く反映されるようになったことの
裏付け。続けて`BUNDLE_DATATYPE=lineage bundle.py 1`(26.5秒)→
`MERGE_DATATYPE=lineage merge_japan_bundles.py`(D144の自動cluster込み、
86秒)を実行。結果: `bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`
204.7MB(旧204.6MBとほぼ同一——低ズーム分の実データ増加はバイト数
としては小さい)、`./pmtiles verify`クリーン(56ms)、
`min zoom:4`/`max zoom:16`/`clustered:true`。tile contents 423,000
(旧422,889から微増、一貫性あり)。

### 現在の状態

修正・再生成・merge完了、**stars公開はまだ未実施**——別途確認の上で
実施する(旧ファイルは204.6MBと小さいため、D142/D145のような
delete-then-transferパターンは不要、上書き転送で問題ない見込み)。

### Resume prompt

> D152: コードレビューで見つかった重大バグ——`lineage_extend_low_zoom.py`
> (D146)のz8検出globが非再帰的で、実際のz8アーカイブ107件中14件
> (13%)しか読めていなかった(残り93件はutils.get_pmtiles_folder()の
> z7バケット配下で不可視)。公開中のz4-z7 lineageデータは日本の
> ごく一部からしか構築されていなかったことになる。修正
> (`glob(..., recursive=True)`+basename→相対パスのマッピング)を
> 実データで検証(107件全検出、実z8タイル440件)、再生成
> (z7:68→117、z6:17→37、z5:10→13)、bundle→merge(D144の
> 自動cluster込み)まで完了——`bundle-store/mapterhorn-japan-
> bridge-lineage.pmtiles`204.7MB、verify OK、min/max zoom 4/16、
> clustered:true。**次のアクション**: starsへの公開(旧ファイルが
> 小さいため上書き転送で良さそうだが、実施前に要確認)。並行して
> D148(elevation bundle→merge→z0-7再接合)も進行予定。


## D153: D148(elevation再生成)・D152(lineage低ズーム修正)、stars公開完了・実地確認クリーン

**Status**: Recorded, 2026-09-09 03:03 JST頃。

### 公開作業

Hidenoriさんの明示的な承認(「両方とも進める」)を得て、D142/D145と
同方式(delete-then-transferパターン)でstarsへ公開した。

1. stars側旧elevationファイル(314.66GB、D145)を削除。
2. `bundle-store/mapterhorn-japan-bridge.pmtiles`(258.08GB、D148の
   丸め処理修正込み)を`.new`へrsync転送(`-avW --progress -e 'ssh
   -A'`、slateの`openrsync`が`--info=progress2`未対応のため
   `-avW`を使用、D142と同じ)。
3. `bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`(204.7MB、
   D152の低ズームglob修正込み)を`.new`へrsync転送。
4. stars側`pmtiles verify`(elevation・lineage両方)。
5. アトミックリネーム(`.new`→本番名)。
6. `systemctl --user restart martin`。

スクリプト(`/tmp/publish_d148_d152.sh`、`publish_1p5go.sh`のD142版を
踏襲)を`screen`(`publish_d148_d152`)で実行、20:50:32 JST着手、
03:02:57 JST完了(所要約6時間12分)。

### 実測転送速度とETA予測の検証

転送中、stars側の一時ファイル(`.mapterhorn-japan-bridge.pmtiles.new.*`)
の実サイズを複数時点でsshから直接確認し、実測速度(~11.0-11.6MB/s、
D142の実績とほぼ一致)から完了時刻を都度再計算——23:13時点で
「約03:00-03:20 JST」と予測し、実際の完了(03:02:57)はこの予測
レンジ内に収まった。

### 実地確認(既知座標のバイト数比較)

| 確認項目 | 結果 |
|---|---|
| elevation TileJSON | `minzoom:0`/`maxzoom:16`/bounds全球/center(140.9,41.85,12)——正常 |
| elevation z13/6894/3521(与那国) | HTTP 200、**64,276 bytes——D145の検証値と完全一致** |
| elevation z8/219/101(対馬・五島) | HTTP 200、**61,812 bytes**(D145時点は225,036 bytes) |
| lineage TileJSON | `minzoom:4`/`maxzoom:16`/bounds日本域——正常(D146拡張が反映済み) |
| lineage z8/219/101 | HTTP 200、**490 bytes——D145の検証値と完全一致** |

elevation z8/219/101のバイト数減少(225,036→61,812、約72.5%減)は
**想定通り、regressionではない**——この座標はdownsampling層のタイル
であり、D148の丸め処理修正(downsampling層のみ対象、実測78.7%削減)の
直接的な効果。一方、elevation z13(aggregation層、丸め修正の対象外)は
D145時点と完全に同一バイト数——意図しない変更が紛れ込んでいないことの
裏付けになっている。lineageのz8タイルも完全一致——D148はelevationのみ
対象で、lineage側はD152の修正のみが効いていることと整合する。

### 現在の状態

**D148・D152とも公開完了、実地確認クリーン。** 1.5号のelevation・
lineage両アーカイブが最新の修正を反映した状態でstars上に live。

### Resume prompt

> D153: D148(elevation丸め処理修正の再生成)とD152(lineage低ズーム
> glob修正)を、Hidenoriさんの承認を得てstarsへ公開完了(2026-09-09
> 03:02:57 JST、所要約6時間12分、D142と同じdelete-then-transfer
> パターン)。実地確認クリーン——既知座標のバイト数が、丸め修正の
> 対象外のelevation z13・lineage全体はD145検証値と完全一致、丸め
> 修正の対象であるelevation z8(downsampling層)は約72.5%減と、
> それぞれ想定通りの結果。**次のアクション**: 特になし、1.5号は
> これで最新状態。9件残っている他のコードレビュー所見(D152参照)の
> 取捨選択、1.6号(D149-151、`downsampling_covering.py`の再設計待ちで
> ブロック中)の再開、2号(GSI新DEM1A更新待ち)は、いずれも
> このセッションでは着手しない想定。


## D154: D152コードレビューの残り所見を実コードで再検証・triage——6件修正、2件は再検証の結果「対応不要」と判明

**Status**: Fixed/triaged, 2026-09-09。`hfu-mapterhorn`コミット
(次のpushで確定)。

### 経緯

D152のコードレビューが報告した「最重要バグ以外の残り所見」を、
今回すべて実コードを読み直して1件ずつ検証した。レビュー結果の要約
(HANDOVER.mdに残っていた圧縮済みの説明文)だけを鵜呑みにせず、
実際のコード・実データで裏取りしてから対応を決めた。

### 1. `majority_vote_downsample()`のargmax-on-all-zeroバグ——**再検証の結果、バグではないと判明**

懸念: 2x2ブロックが全てnodataの場合、`counts`が全ゼロになり
`np.argmax`はインデックス0(tier 0 = 1m)を返す——これがそのまま
「勝者」として扱われるのではないかという疑い。

実際には`parent_values = np.where(any_valid, winning_category,
NODATA)`が、`any_valid=False`のセルでは`winning_category`の値を
完全に捨ててNODATAで上書きする設計になっており、argmaxの計算結果が
最終出力に漏れ出ることはない。実データ相当の入力で直接検証:

```python
values = np.full((1024,1024), NODATA, dtype=np.int8)
alpha = np.zeros((1024,1024), dtype=np.uint8)
pv, pa = majority_vote_downsample(values, alpha)
assert pv[0,0] == NODATA and pa[0,0] == 0  # PASS
```

**対応: なし(REFUTED)。** 関数はレビュー時点から一貫して正しい。

### 2. all-nodataな親タイルが書き込まれ、次のレベルへ伝播していた——**実データで確認、修正**

`lineage_extend_low_zoom.py`の`build_level()`は、4子タイル全てが
nodataになる親タイルも無条件にWebPエンコード・書き込みし、さらに
次のズームレベルの`source_tiles`にもそのまま含めていた。実害は
「情報量ゼロの透明タイルが無駄に量産され、以降の全レベルで
再発見され続ける」という効率面の問題(レンダリング上は不正ではない
——alpha=0のnodata表現は他の場所と一貫している)。

**実データで検証**(z8→z7、107アーカイブ・440タイルから117個の親
タイルを算出): **117個中29個(約25%)がall-nodata**だった——
無視できない規模。

**対応: 修正。** `build_level()`で`parent_alpha.any()`が偽の親タイルは
書き込みをスキップし、`written_parents`(実際に書いたものだけ)を
次のレベルへ渡すよう変更。修正後の同じ実データ検証で
「117個中29個スキップ、88個書き込み」を確認、`0-0-0-7.pmtiles`は
`pmtiles verify`相当(`pmtiles show`)でclustered:true・妥当な
bounds/zoomを確認。本番の`pmtiles-store`には一切触れず、
`/tmp`のシンボリックリンクミラー上でのみ検証。

### 3. `aggregation_tile.py`/`lineage_tile.py`のファイル名バグ修正で「レースウィンドウが広がった」——**再検証の結果、逆に縮まっていたと判明**

D150/D151のコミット(`d0ec58c`)の実際のdiffを読み直した。変更は
「`create_tiles()`の戻り値(真のchild_z)を使うために、その呼び出しを
早める」だけで、旧stale出力の削除(`glob`+`os.remove`)自体の
タイミングは変わっていない——ただし**`create_tiles()`(重い処理:
全タイルのラスタ読み込み・エンコード)が削除より前に完了するように
なった**ため、「旧ファイル削除〜新ファイル書き込み完了」の間隔は
`create_archive()`単体の時間に短縮された(以前は
`create_tiles()+create_archive()`の合計時間だった)。

さらに、`utils.create_archive()`自体が既に「同一ディレクトリに
`.tmp-{pid}`で書いてから`os.replace()`で原子的に配置」という設計
(D37/D44と同種のレース対策、コード内コメントに明記済み)になって
おり、書き込み中の部分読み取りはそもそも起こらない。

**対応: なし。** 実際にはレースウィンドウは広がるどころか縮まって
おり、修正の必要はない。

### 4. 丸め処理の上限値(`factor > 32`)が無説明——確認の上、コメント追加

upstream本家コミット`53e4d3d`を直接確認したところ、この上限自体が
**upstream側でも無説明のまま存在**していることを確認(独自に付け足した
ものではなく、忠実な移植)。低ズームで係数が際限なく大きくなる
(z0で2048m相当)のを防ぐための上限であることは推測できるが、
「なぜ32という値なのか」はupstream側でも分からない。

**対応: 修正。** `utils.get_rounded_elevation_data()`に、上限が
必要な理由(無制限だと低ズームで標高を数百〜数千m単位に丸めてしまう)
と、具体的な32という値自体はupstream由来で独自に再導出したものでは
ない旨を明記するコメントを追加。

### 5. `lineage_extend_low_zoom.py`と`downsampling_run.py`のコード重複——確認の上、共通化

両ファイルとも「多数決downsample→NODATA→255変換→RGBA組み立て→
lossless WebP encode」という同じ手順を別々に実装していた。
`lineage_downsample.py`に`build_parent_tile_bytes(full_values,
full_alpha)`を新設し、両方の呼び出し元をこれに置き換えた。副産物として、
`downsampling_run.py`側にあった`parent_alpha > 0`→`np.where(...,255,0)`
という冗長な処理(`majority_vote_downsample()`が既に0/255の二値しか
返さないため無意味だった)も自然に解消された。

**対応: 修正。** 実データでの単体テスト(all-nodata入力・実データ
形状入力の両方)、および項目2の実データ検証(この共通化後のコードで
実行)で動作確認済み。

### 6. 低ズームlineageアーカイブに`.done`マーカー相当のものがない——確認の上、軽量マーカーを追加

`lineage_extend_low_zoom.py`は`downsampling_run.py`本体の
`.done`マニフェスト体系(`mjb-done-manifest/1`)を経由しない、
意図的なスタンドアロンスクリプト(D146の設計)——そのため、この
ステップが実際に走ったかどうかを示すディスク上の痕跡が一切なかった。
CLAUDE.mdの「`.done`件数だけを正しさの証拠にしない」という標準的な
注意はここでは逆方向にも当てはまる——「痕跡が全くない」状態では
将来のセッションが「このステップは実行済みか?」を出力状態からしか
推測できない。

**対応: 修正。** 実行完了後に`{FOLDER}/lineage-extend-low-zoom.done`
(generation_id・source/target zoom・各レベルのタイル数・完了時刻を
含むJSON)を書き出すようにした。重い per-item マニフェスト体系への
統合は、この一回限りの5秒程度のスクリプトには過剰と判断し見送った。

### 7. `get_cached_reader()`にキャッシュ鮮度チェックがない——実害なしと確認、コメントを是正

既存コードには「ファイル名にchild_zサフィックスが含まれるため
同一パスへの上書きは起こらない、よって鮮度チェック不要」という
明示コメントがあったが、これは`aggregation_tile.py`/
`downsampling_run.py`本体の命名規則に基づく主張であり、
`lineage_extend_low_zoom.py`(D146)の`0-0-0-{zoom}.pmtiles`という
**固定ファイル名**(内容が変わっても同じパスに書き直される)には
本来当てはまらない——このコメントの前提を静かに破る新しい呼び出し元が
増えていたことになる。

実害の有無を検討: `lineage_extend_low_zoom.py`は毎回まっさらな
単一プロセスとして起動され、同一実行内で同じパスを「書き直し→再読込」
することはない(各ズームレベルは別ファイル名)。長時間生存する
Poolワーカーがこのパスを再読みする経路も現状ない。**結論: 現状では
実害なし**、ただし前提が暗黙的に破られている状態は将来のリスク。

**対応: 修正版はコードの挙動を変えず、コメントのみ是正。**
共有キャッシュのホットパス(`downsampling_run.py`本体、数百万回規模の
呼び出しがあり得る)に`stat()`を毎回追加するコストは、現状ゼロの
リスクに対して見合わないと判断——キャッシュの鮮度保証は
「命名規則で上書きが起きない」呼び出し元にのみ及ぶことを明記し、
固定ファイル名を再利用する将来の長時間生存プロセスは自前で鮮度確認
すべき旨を警告するコメントに書き換えた。

### 8. `build_level()`内でエンコード→ディスク書き込み→デコードの無駄な往復——確認の上、対応見送り

各レベルで直前に計算したnumpy配列をWebPにエンコードしてディスクに
書き込み、次のレベルでそのファイルを開いてデコードし直している——
インメモリの配列をそのまま次のレベルへ渡せば省略できる工程。

**対応: なし。** このスクリプト自体が「日本全体のz4-z7タイル数は
tiny」という前提でシンプルさを優先する設計だとdocstringに明記して
おり(D146)、実測でも全体の所要時間はわずか数秒(D149実測5.2秒)
——最適化の実利が小さい割に、`build_level()`の関数シグネチャ
(ファイルベースの`source_tiles`/`tile_to_filename`という単純な
インターフェース)を複雑化するコストの方が高いと判断した。

### 変更ファイル(`hfu-mapterhorn`)

- `pipelines/lineage_downsample.py`: `build_parent_tile_bytes()`新設。
- `pipelines/downsampling_run.py`: lineage分岐を共通化関数呼び出しに
  置き換え、`get_cached_reader()`のコメント是正。
- `pipelines/lineage_extend_low_zoom.py`: all-nodata親タイルの
  スキップ、`.done`マーカー出力、共通化関数の利用、未使用の
  `imagecodecs` importを削除。
- `pipelines/utils.py`: `get_rounded_elevation_data()`の丸め上限に
  説明コメント追加。

いずれも実データ・実本番`pmtiles-store`には一切書き込んでいない
(検証は全て`/tmp`のシンボリックリンクミラー、または純粋な
in-memoryの単体テストで実施)。**次に`downsampling_run.py`/
`lineage_extend_low_zoom.py`が本番で実際に走るのは1.6号または
2号の時点**——その時に今回の変更が初めて本番データに対して動く
ことになるが、ロジック自体は既存の実データでの単体テスト・
部分実行検証で確認済み。

### Resume prompt

> D154: D152のコードレビュー残り所見(8件確認できた、レビュー要約は
> 「9件」としていたが1件は復元できず)を実コードで再検証。2件は
> 再検証の結果「対応不要」と判明(majority_vote_downsample()の
> argmax懸念はnp.whereマスクで既に正しく処理されていた/`aggregation_
> tile.py`のレースウィンドウはD150/D151の修正で逆に縮まっていた)。
> 残り6件を修正: (1)all-nodata親タイルのスキップ(実データで117件中
> 29件がall-nodataと確認、修正で正しくスキップされることも確認)、
> (2)丸め上限値へのコメント追加(upstream側も無説明と確認済み)、
> (3)`lineage_downsample.build_parent_tile_bytes()`への共通化(副産物で
> 冗長コードも解消)、(4)低ズームアーカイブの完了マーカー追加、
> (5)`get_cached_reader()`のコメント是正(実害なしと確認、ホット
> パスへのstat追加は見送り)。全て実データでの部分検証・単体テスト
> 済み、本番`pmtiles-store`は無傷。**次のアクション**: `hfu-
> mapterhorn`側の変更をコミット・push。その後は1.6号
> (`downsampling_covering.py`再設計待ちでブロック中)や2号の
> readiness項目(5m/10m破損チェック、D57 dirty-tracking)へ進む余地
> があるが、いずれもこのセッションでの着手は未定。


## D155: Oliverの丸め処理フォローアップ(上限32m→1m)を移植・実測。再生成の要否はHidenoriさんの判断待ち

**Status**: Code ported, measured, publish decision pending, 2026-09-09。

### 経緯

D148で移植したOliver Wipfliの丸め処理修正(commit `53e4d3d`)には
`factor > 32`という無説明の上限値があった(D154の項目4で「upstream側も
無説明」とコメントに明記したばかり)。Hidenoriさんから、Oliverより
続報があったと共有を受けた:

> Thanks for the update. Note that 32 m might be too much as a max
> rounding value. Switched now to a max of 1 m.

upstream本体を確認したところ、実際に該当コミットが存在した:
[`e964a04`](https://github.com/mapterhorn/mapterhorn/commit/e964a048)
「Clamp vertical rounding to 1 meter」(#310、2026-09-08)——`53e4d3d`の
まさに数日後の、Oliver自身によるフォローアップ修正。diffは
`if factor > 32: factor = 32`を`if factor > 1: factor = 1`に変える
だけの1行変更。

### 移植内容

`hfu-mapterhorn/pipelines/utils.py`の`get_rounded_elevation_data()`を
upstreamと同じ`factor > 1`/`factor = 1`に変更。あわせて、D154で
「32という値の根拠は不明」と書いたコメントを、今回判明した経緯
(Oliver自身が32mを「too aggressive」と判断し1mへ引き締めた)を
反映する形に更新した。

### 影響範囲の再確認

`factor(z) = 2^(19-z)/256 = 2^(11-z)`——上限が実際に効くのは
`factor`が上限を超えるズームのみ:
- **旧上限32**: z≤5でのみ発動(z=5で64→32に切り詰め)。
- **新上限1**: z≤10で発動——z=6〜10(自然係数32,16,8,4,2)も
  一律1mに切り詰められるようになる。**影響範囲がz0-5からz0-10へ
  大幅に拡大した。**

### 実測(実データ、`create_tile()`を直接実行)

1.5号(`01M1MKD73P0KDT719H21NJV9VR`)の実`downsampling.csv`から、
影響範囲(parent_z≤10)に該当する層別サンプル103件
(z5:3, z6:20, z7:20, z8:20, z9:20, z10:20——各層最大20件を無作為抽出)
を選び、`downsampling_run.create_tile()`を新コード(上限1m)・旧コード
(上限32m、その場でmonkeypatch)の両方で直接実行、実際のWebPエンコード
後バイト数を比較(本番`pmtiles-store`は読み取り専用アクセスのみ、
出力は`/tmp`の使い捨てフォルダ)。

| | 上限32m(旧) | 上限1m(新) |
|---|---|---|
| 103件合計 | 59,872 bytes | 98,850 bytes |

**新上限は影響範囲(z5-10)のサンプルで旧上限より約65.1%大きい**——
D148の78.7%削減効果のうち、この帯域に相当する部分がかなり
巻き戻ることになる(ゼロには戻らない——丸め処理自体、すなわち
「丸めなし」というD148以前の状態よりは依然として小さいはずだが、
今回のサンプルではその基準との比較は行っていない)。この数値は
downsampling層のz5-10帯のみのサンプルであり、D148の実測時と同様、
アーカイブ全体でのパーセンテージはこれより緩和される見込み
(D148では downsampling層単体78.7%減 → アーカイブ全体では18%減)。

### aggregation層への影響確認(再生成前のチェック)

`get_rounded_elevation_data()`は`downsampling_run.py`だけでなく
`save_terrarium_tile()`(aggregation層、ネイティブ解像度タイル)からも
呼ばれる共有関数——上限を変えるならaggregation層のネイティブ
maxzoomが低い(z≤10)アイテムにも影響しうる、という懸念を再生成前に
実データで確認した。1.5号の全6,373 aggregationアイテムの実際の
child_z分布を集計したところ、**最小がz12**(z12:2,240件、z13:1,564件、
z14:564件、z16:2,005件)で、z≤10のアイテムは**ゼロ件**。
`factor(12)=2^(11-12)=0.5`は旧上限32・新上限1のいずれよりも
既に小さいため、aggregation層はどちらの上限でも実質未発動——
**downsampling層のみの再生成で整合性は保たれることを確認した**
(D148の時と同じ前提が今回も成立)。

### Hidenoriさんの判断・実施

「合わせて行えるバグ修正などとまとめた上で、再生成・再公開する」との
指示を受けた。D154で実装済みだが本番未反映だった
`lineage_extend_low_zoom.py`のall-nodata親タイルskip修正
(D154項目2)も、今回のelevation再生成と合わせて一度に反映することにした。

**実施内容**:
1. `lineage_extend_low_zoom.py`を本番で再実行(所要数秒)——
   z7:117→**88件**(29件のall-nodata親タイルを正しくskip、D154の
   修正が実データでも効くことを確認)、z6:37/z5:13/z4:6(不変)。
   完了マーカー`lineage-extend-low-zoom.done`も初めて生成された。
2. elevation側の`*-downsampling.done`マーカー8,223件を削除、
   `downsampling_run.py`を`screen downsample_1m_cap`で再実行開始
   (2026-09-09 21:08 JST、D148と同じ手順・ワーカー数)。

### 現在の状態

lineage側の再生成は完了。elevation側のdownsampling再生成が進行中
——完了後、D148と同じ手順(bundle→merge→z0-7再接合→verify)を
elevation・lineage両方で実施し、まとめてstarsへ再公開する予定
(delete-then-transferパターン、D142/D145/D153と同じ)。

### Resume prompt

> D155: Oliver Wipfliのフォローアップ(丸め処理の上限を32m→1mへ
> 引き締め、upstream commit `e964a04`)を`hfu-mapterhorn/pipelines/
> utils.py`に移植・push済み。実データ103件で実測: 新上限は影響帯域
> (z5-10)のサンプルで旧上限より約65.1%大きい。**再生成前にaggregation
> 層への影響を確認**——1.5号の全aggregationアイテムのネイティブ
> maxzoomは最小z12で、上限の影響範囲(z≤10)に該当するものはゼロ件、
> downsampling層のみの再生成で整合性が保たれることを確認した。
> Hidenoriさんの判断で「合わせて行えるバグ修正とまとめて再生成・
> 再公開する」ことになり、D154で実装済み未反映だった`lineage_
> extend_low_zoom.py`のall-nodata親タイルskip修正も一緒に本番反映
> (z7:117→88件、29件skip)。elevation側の`downsampling_run.py`再実行
> (`screen downsample_1m_cap`、2026-09-09 21:08 JST着手、D148と同じ
> 8,223件・約4〜5時間見込み)が進行中。**次のアクション**:
> downsampling完走を待ち、bundle→merge→z0-7再接合→verify
> (elevation・lineage両方)→stars公開(delete-then-transfer、
> D142/D145/D153と同じ手順)。


## D156: このセッションのエージェントは(aaltoではなく)slate自身の上で動いていた——不要なSSH自己接続の試行で時間を浪費

**Status**: Recorded, 2026-09-10 早朝JST。

### 発生した事象

D155のelevation downsampling再生成(`screen downsample_1m_cap`)の完了確認をしようとした際、Monitorタスクから「メインプロセス(PID 20860)が完了マーカーなしで終了した」というアラートを受けた。状況確認のため`ssh hfu@slate.local '...'`を実行したところ、**`Too many authentication failures`で繰り返し拒否された**——CLAUDE.mdの「一台構成(D12)、everything now runs on slate over SSH from whatever machine hosts this conversation」という記述を鵜呑みにし、このセッションのエージェント自身がslateとは別のマシン上で動いていると無条件に仮定していたため、SSH接続を試みた。

`~/.ssh/config`のデフォルト鍵(`id_rsa`・`id_ed25519`)を明示指定しても全て拒否され、`ssh-agent`のソケットも死んでいて他の鍵を提示できない状態だった。ユーザーに確認を依頼したところ、ユーザー自身の端末(`aalto`)からは`ssh hfu@slate.local`が問題なく通ることが判明し、SSH自体は生きている(＝slateのsshd設定やネットワークの問題ではない)ことが分かった。

### 根本原因

**このセッションのエージェント自身が、最初からslate.local上で直接実行されていた**。`uname -a`が`Darwin slate.local ...`を返し、決定的な証拠として`/Volumes/Migrate-2025-04`のマウント種別が`diskutil info`で**Protocol: USB、`mount`コマンドでも`local`**(SMB/NFS等のネットワークマウントではない)と確認された——USB接続のローカルディスクは、物理的に接続されたマシン上でしか`local`としてマウントされ得ない。つまり`ssh hfu@slate.local`は**自分自身への接続**を試みていたことになり、鍵が拒否されて当然だった(そもそも自己ループへの公開鍵認証を成立させる鍵ペアの用意などしていない)。

CLAUDE.mdの「everything now runs on slate over SSH from whatever machine hosts this conversation」という記述は、このプロジェクトの典型的な運用形態(aaltoやユーザーの手元端末からslateへSSHする)を説明したものであり、**「Claude Codeのセッション自体がどのマシン上でホストされるか」は会話ごとに変わりうる**——今回はセッションのホストそのものがslateだった。この記述を「エージェントは常にslate以外の場所から動く」という不変条件のように読み違えたのが直接の誤り。

### 実害

- 数回のSSH試行で`Too many authentication failures`によりslateのsshdから切断され、これ以上続けるとレート制限(fail2ban的な仕組み)を誘発しかねないリスクがあった(実際には発生しなかったが、ユーザーへの確認待ちで手が止まった)。
- ユーザーに「ファイルシステムだけ見えていて実行はできないのでは」という誤った印象を与えかけた(実際にはBashツールでの直接実行が最初から可能だった)。
- 実質的な遅延は数分〜十数分程度で、データやパイプラインへの実害はゼロ(ダウンサンプリング自体は`.done`マーカー8,223件・`check_downsampling_done_integrity.py`で健全性確認済み、正常完了していた——Monitorアラートの「完了マーカーなし」自体も誤検知で、`downsampling_run.py`はそもそもループ後に完了メッセージを一切出力しない仕様だった)。

### 教訓・今後への申し送り

- **SSHを使う前に、まず`hostname`/`uname -a`で「自分が今どのマシン上で動いているか」を確認する**。CLAUDE.mdの「一台構成・SSH運用」の記述はあくまで典型パターンの説明であり、セッションごとに再検証すべき前提であって、無条件に信じてSSHを打ち始めるべきではない。
- ローカル実行かリモート実行かを見分ける最も確実な方法は、`hostname`だけでなく**マウント種別の確認**(`diskutil info <path>`のProtocol欄、または`mount`コマンドの出力)——ネットワーク越しなら`smbfs`/`nfs`等、物理ローカルなら`local`(USB/内蔵等)と出る。`hostname`だけだと(理論上は)偽装や巧妙な設定で誤認しうるが、USBローカルマウントは原理的に同一マシンでしか成立しない。
- SSH認証が立て続けに失敗する状況に陥ったら、鍵を総当たりし続けるのではなく、**「そもそも接続先が正しいか」を先に疑う**——特に「自分自身への接続」というパターンは、意外と見落としやすい。
- Monitorタスクの完了条件(「完了マーカーの有無」等)を設定する際は、監視対象スクリプトの実際の出力仕様(この場合`downsampling_run.py`はループ後に何も印字せず、プロセスが正常終了するだけ)を事前にコードで確認してから条件文を書く。存在しない出力を待つアラート条件は、正常終了時にも必ず誤検知する。

### Resume prompt

> D156: このセッションのエージェント自身が(想定していたaaltoではなく)slate.local上で直接動いていたことが判明(`hostname`=`slate.local`、`/Volumes/Migrate-2025-04`はUSBローカルマウント)。それに気づかずSSH自己接続を試みて`Too many authentication failures`で時間を浪費した。D155のelevation downsampling再生成自体は正常完了していたことを`check_downsampling_done_integrity.py`で確認済み(8,223件健全、stale 0件)——Monitorの「完了マーカーなし」警告は`downsampling_run.py`が元々完了メッセージを出力しない仕様による誤検知だった。**次のアクション**: SSHを介さず直接Bashで、D155のbundle→merge→z0-7再接合→verify(elevation・lineage両方)→stars公開の残り工程を進める。


## D157: D155のmergeステージがENOSPCでクラッシュ。9/3付けの孤立スクラッチ578GBが真因、6日間死んでいたdisk_headroom監視も復旧

**Status**: Recorded, 2026-09-10 昼過ぎJST。

### 発生した事象

D155のelevation bundle→merge工程で、`meta-store/bundle/*.json`をクリアし(D125のランブック通り)、bundle.py(23ファイル、237.4GiB)を完走させた後、`merge_japan_bundles.py`(`MERGE_DATATYPE=elevation`)を実行したところ、230万タイル書き込み時点で

```
OSError: [Errno 28] No space left on device
```

でクラッシュした(`writer.write_tile()`内、`pmtiles/writer.py`)。

### 調査と根本原因

1. **`bundle-store/mapterhorn-japan-bridge.pmtiles`(旧D153公開物、258GB)がbundle-storeに残存**していたため、`merge_japan_bundles.py`の完全性チェック(D117/D119)に一度引っかかった。これは削除ではなく同一ボリューム内リネーム退避(`*.d153-backup`、即時・追加容量不要)で解消——この時点では実害なし(`/Volumes/Migrate-2025-04`側は702GiB空きがあり、真因ではなかった)。
2. **真因は別ボリューム**: `merge_japan_bundles.py`のTMPDIR(`pmtiles-store/tmp-store/writer-scratch/`、`/Volumes/pmtiles-store`が実体)に、**9/3付けの孤立スクラッチファイルが2つ、各310GB・計578GB**残存していた(`pmtiles1854011298`・`pmtiles4100108522`)。`lsof`で確認したところどのプロセスも開いておらず、日付・サイズ(310GB)ともD125の記述にある「D115の310GB破損事故と同じ機構」の残骸と符合する——D115当時の後片付けが不完全だったまま6日以上放置されていたとみられる。このため`/Volumes/pmtiles-store`の実質空き容量は228GiBしかなく、今回のmergeが要求する規模(入力合計237.4GiB)にわずかに届かなかった。
3. ユーザーに削除の許可を得た上で両ファイルを削除、578GB解放(228GiB→806GiB)。
4. **`merge_japan_bundles.py`は消費した入力ファイルを都度削除する設計**(D117/D119、途中終了時の部分再開を防ぐための意図的な挙動)のため、クラッシュまでに処理済みだった15件の地域別bundleファイルは既に削除済みだった。復旧には**bundle.pyの再実行**(常にフルパスのため冪等に23ファイルを再生成)が必要だった——これ自体は設計通りの自己修復パスであり、バグではない。

### 副次的な発見: `disk_headroom`監視が6日間沈黙していた

上記調査の過程で、`check_disk_headroom.py`の定期監視(`screen disk_headroom`、D127で`/Volumes/pmtiles-store`もカバー済みのはず)のログ(`disk_headroom.log`)が**2026-09-04T19:48:32を最後に6日間一切更新されていない**ことが判明した。プロセス自体(PID 598/600/601)はFriday 08PMから5日22時間動き続けており(`sleep 900`のループ自体は生きていた)、クラッシュはしていない——にもかかわらずログが増えていなかった。

同じコマンド(`uv run python3 check_disk_headroom.py`、`--no-sync`なし)を手元で直接実行すると即座に正常終了・ログ出力されたため、スクリプト自体の不具合ではない。このループが起動時(Friday)から`--no-sync`なしの`uv run`を使い続けていたことが疑わしい——このプロジェクトの他の長時間バックグラウンドジョブ(`downsampling_run.py`・`bundle.py`・`merge_japan_bundles.py`)は軒並み`uv run --no-sync`を使う運用に既に統一されている一方、この監視ループだけ取り残されていた。6日間、`uv run`の暗黙sync処理がそのプロセスの環境下でのみ毎回無音で失敗し続けていた(`while true`ループ構造上、`uv run`の非ゼロ終了はループ自体を止めない)と推測されるが、厳密な原因特定はできていない。

**結果として、D129のカーネルパニック復旧から今回のENOSPCクラッシュに至るまでの6日間、ディスク headroom 監視は実質機能していなかった。** D127で「pmtiles-storeもカバーするよう拡張してから進める」という条件付き承認を得た監視体制が、まさにそれが必要だった今回の場面で沈黙していたことになる。

**対応**: 古いループ(PID 598とその子プロセス600/601、`screen -X -S disk_headroom quit`後も生き残った子は個別`kill`)を停止し、`uv run --no-sync python3 check_disk_headroom.py`を使う新しいループ(`screen disk_headroom`、PID 34838)で再起動。即座に正常なログ出力を確認。

また、`check_disk_headroom.py`の既定閾値(`--warn-gb 200`)も、今回の実例(228GiB空き=「ok」判定だったが、237.4GiBの入力を扱うmergeには不足)に照らすと**単発の大規模mergeステージに対しては閾値が実態に対して低すぎる**——閾値自体の見直しは今回未実施、次回セッションへの申し送りとする。

### 教訓・今後への申し送り

- **`bundle-store`/`pmtiles-store`配下のスクラッチ・TMPDIR領域は、クラッシュ後に手動で確認・掃除する習慣がないと際限なく蓄積する**——D115からD157まで、実に6日間気づかれなかった。次回大規模ステージ(bundle/merge/pmtiles系コマンド)着手前には`du -sh pmtiles-store/tmp-store/*`相当の一括確認をランブックに追加することを検討。
- **`while true; do <cmd>; sleep N; done`型の監視ループは、`<cmd>`が毎回無音で失敗しても気づけない**——ループ自体の生存(`ps`で見える)と、ループが実際に仕事をしているか(ログが伸びているか)は別物。長時間動かす監視ループも、`downsampling_run.py`等の本番ジョブと同じく`uv run --no-sync`で統一し、かつ稼働状況そのものを(ログの最終更新時刻など)別途チェックする仕組みがあるとなお良い。
- **`check_disk_headroom.py`の警告閾値は、個々のパイプラインステージが実際に要求する最大スクラッチ容量を踏まえて再検討すべき**——現行の200GB/80GBは、数百GB規模の単発mergeが日常的に走るこのプロジェクトの実態に対してやや楽観的。
- **`merge_japan_bundles.py`は入力を消費しながら進む(D117/D119)ため、途中でクラッシュしたら`bundle.py`の再実行が必要**——今回はこの設計を正しく認識していたため復旧は数分で完了したが、知らずに「なぜファイルが消えた」と混乱するとロスタイムになる。ランブックの「merge失敗時の復旧手順」として明記する価値がある。

### Resume prompt

> D157: D155のelevation merge(`merge_japan_bundles.py`)が230万タイル地点でENOSPCクラッシュ。真因は`pmtiles-store/tmp-store/writer-scratch/`に残っていた9/3付け孤立スクラッチ2件・計578GB(D115の残骸とみられる、lsofでどのプロセスも未使用と確認の上ユーザー許可を得て削除、228GiB→806GiB)。`merge_japan_bundles.py`は消費済み入力を削除する設計のため、bundle.pyを再実行して23地域ファイルを再生成中。副次的に、`disk_headroom`監視ループが2026-09-04T19:48以来6日間ログ更新なしで沈黙していたことも発覚(`uv run`に`--no-sync`が無かったための無音失敗と推測)——`--no-sync`付きの新ループ(PID 34838)で復旧済み。**次のアクション**: bundle.py再完走を待ち、merge_japan_bundles.py(elevation)を再実行→D144自動cluster→`pmtiles merge`(z0-7再接合)→verify、続けてlineage側も同様にbundle→merge→verify、最後にstars公開。


## D158: `/Volumes/Migrate-2025-04`がstars公開直前に瞬断・自動復旧。データ無傷を確認

**Status**: Recorded, 2026-09-11 未明JST。

### 発生した事象

D155/D157のelevation・lineage両アーカイブが完成・verify済みとなり、stars公開スクリプト(`publish_d155_d157.sh`、D148/D153の`publish_d148_d152.sh`を踏襲)を起動しようとした直後、シェルから

```
Working directory "/Volumes/Migrate-2025-04/github/mapterhorn-japan-bridge" was deleted; shell cwd recovered to "/Users/hfu".
```

というエラーが出た。確認すると`/Volumes/Migrate-2025-04`ボリューム自体がアンマウントされていた。

### 調査

- `uptime`は「6日間継続稼働」を示しており、D129のようなカーネルパニック・再起動ではないことを確認。
- `diskutil list`のディスク識別子が`disk6s2`→`disk4s2`に変化していた——USBストレージがOS的に一度切断・再列挙されたことを示す典型的な兆候。
- `diskutil mount disk4s2`が2分以上応答せず(バックグラウンドへ自動退避)、その間`diskutil list`ですら他のdiskutil呼び出しに巻き込まれてブロックされた(`diskarbitrationd`を介した直列化とみられる)。
- 約1分半後、バックグラウンドの`diskutil mount`が正常終了(exit 0)し、ボリュームは自動的に復旧・再マウントされた。作業ディレクトリも自動的に復帰した。
- `/Volumes/pmtiles-store`(別ボリューム、別USB経路)はこの間ずっと正常にマウントされたまま、影響を受けなかった。

### データ整合性の確認

このタイミングでは書き込み中のファイルは存在しなかった(問題の`bundle-store/mapterhorn-japan-bridge.pmtiles`・`-lineage.pmtiles`はいずれも数時間前に`pmtiles cluster`/`pmtiles merge`が完了しファイルクローズ済みだった)。念のため再マウント後に両ファイルのサイズ・mtimeが切断前と完全一致することを確認し、さらに`./pmtiles verify`を再実行して両方とも異常なしを確認した。データ損失・破損なし。

### 教訓・今後への申し送り

- **`/Volumes/Migrate-2025-04`はUSB接続のため、瞬断のリスクが原理的に常にある**(D156で確認済みの通りUSBプロトコル)——長時間の書き込み処理の最中でなくても、単なるディレクトリ一覧取得のタイミングで起きうる。今回は幸い書き込み完了直後のタイミングで実害はなかったが、大規模mergeの書き込み最中に同様の切断が起きた場合は`OSError`等でクラッシュし、D157と同様の復旧(該当ステージの再実行)が必要になる可能性がある。
- **`diskutil`コマンドが応答しない場合は、慌てて追加のdiskutilコマンドを重ねて実行しない**——`diskarbitrationd`経由で直列化されるため、後続コマンドも巻き込まれてブロックされるだけで状況の理解を進めない。最初の一つ(この場合`diskutil mount`)の完了を待つのが正しい対処。
- 今回は自然に自己復旧したため実害ゼロで済んだが、もし`diskutil mount`が本当にハングしたまま戻らなかった場合の次の一手(物理的な再接続をユーザーに依頼する、など)は今回検討していない——次回同様の事象が長時間解消しない場合は、ユーザーに物理接続の確認を依頼する。

### Resume prompt

> D158: stars公開直前に`/Volumes/Migrate-2025-04`が瞬断(USB再列挙、disk6→disk4)、約1分半で自動復旧。書き込み完了済みファイルのため実害なし(サイズ・mtime一致、`pmtiles verify`再パス確認済み)。`/Volumes/pmtiles-store`は無関係で影響なし。**次のアクション**: D155/D157の成果物(elevation 258.14GB・lineage 204.7MB)のstars公開(`publish_d155_d157.sh`)を続行、完了後にverify・spot-check・HANDOVER更新へ進む。


## D159: Hidenoriさんがstarsの空き容量を拡張。以後の公開は「先に削除」不要になる見込み

**Status**: Recorded, 2026-09-11 未明JST(D155/D157の公開転送中に判明)。

D155/D157の公開転送が進行中、Hidenoriさんから「starsさんと作業をして空き容量を増やした」との報告があった。確認したところ:

```
before (D148/D153時点): /dev/sda2  1.8T  1.6T  201G  89%
after  (今回確認):       /dev/sda2  1.8T  223G  1.6T  13%
```

**stars側の空き容量が201GBから1.6TBへ大幅に拡張された。** これにより、D142以来続けてきた「delete-then-transfer」パターン(新アーカイブを置く容量を確保するため、転送前に旧アーカイブを削除する)は、今後のサイズ(elevation単体で250-260GB程度)であれば**不要になる見込み**——新ファイルを`.new`サフィックスで転送→verify→旧ファイル削除→リネーム、という順序に変更でき、公開中に「一時的にelevationアーカイブが存在しない」窓を作らずに済む。

今回の公開(D155/D157)自体は既に旧delete-then-transferスクリプトで開始済みのため変更せず続行するが、**次回(2号本番公開など)以降のrunbookはtransfer-then-delete順に更新すべき**。

### Resume prompt

> D159: Hidenoriさんの作業によりstarsの空き容量が201GB→1.6TBに拡張された。次回以降の公開スクリプトは「delete-then-transfer」から「transfer(.new)→verify→delete旧→rename」の順に変更でき、公開中にライブアーカイブが消える窓を避けられる。**次のアクション**: 今回の公開は現行スクリプトのまま続行、次回公開スクリプト作成時にこの新しい順序を採用する。


## D160: 【重要な方針決定】上流が同じ源泉に繋がっても2号は継続する——供給責任を果たすには自分で作り続ける必要がある

**Status**: Decided by Hidenori, 2026-09-11 未明JST。プロジェクト全体の位置づけに関わる方針決定。

### 発端: プロジェクト全体の棚卸しで見つかった事実

Hidenoriさんの依頼(「関係プロジェクトの洗い出しと関係の整理、aaltoとslateの使い分け、これまでの活動のあらまし、今後の見通し。あわせてmapterhorn/mapterhornからのダウンストリーム取り込みの可能性と、上流貢献の可能性」)で全体調査を行った際、**ミッションの前提に関わる事実**が判明した。

- Oliver Wipfliは2026-08-21に **`wipfli/japan-download`**(「Mapterhorn download scripts for Japan」)を新設し、**Hidenoriさん自身のSource Cooperative公開物を直接読む**差分取得パイプラインを作っていた。参照先は `https://data.source.coop/smartmaps/japan-geotiff-dem/{1,5,10}/latest_file_list.csv.gz`。
- **実測確認**: その1m版を実際に取得し、こちらの `source-catalog/jpnational1/file_list.csv.gz` と突き合わせたところ、**291,779件のファイル名集合が完全一致**した(ソート後MD5がともに `5ac237886a7efff58c52a9b12c89c67a`、`comm -3`の差分0件、ファイルサイズも同一の8,249,436バイト)。**同一ファイルである。**
- 上流は2026-09-07に `source-catalog/jpdem1a/metadata.json` を更新(`access_year` 2025→2026、承認番号 `R 7JHs 542`→`R 8JHs 131`)。READMEの参照先も `hfu/fusi` から `wipfli/japan-download` へ差し替わった。
- **実測確認**: GSIの更新情報ページをライブ確認、1mメッシュDEM(航空レーザ測量)の最新更新は依然 **2026-07-31** で新規更新なし。公開ファイルリストのDEM1A提供年月も202606が最新(202607以降0件)。

つまり、**上流の `jpdem1a` の素材はもう我々と同一の源泉に繋がっており**、`CLAUDE.md` が掲げる存続条件(「上流の `jpdem1a` が2026-07-31のGSI DEM1A更新を取り込むまで」)は素材レベルでは既に満たされている可能性が高い。

### エージェント(私)の提案と、それに対するHidenoriさんの判断

**私の提案は「2号を先に走らせるより、まずOliverに『上流のタイルはもう新しい素材で焼き直されている?』と聞くのが安くて決定的」というもので、2号を作らずに退役できる可能性を示唆した。**

**Hidenoriさんの判断は、これを明確に退けるものだった:**

> 上流の日本データは、もう我々と同じ源泉に繋がっていても、2号は継続する。japan-geotiff-dem が上流の日本データ供給源そのものになった以上、latest_file_list.csv.gz を安定して出し続けること自体が上流への責任であり貢献であるが、**これを継続するためにも、自ら2号以降を続けることが重要**だと思う。

### この判断の論理と、なぜ記録に値するか

私の提案は「ブリッジの目的＝上流のデータギャップを埋めること」という前提に立っていた。この前提だと、ギャップが閉じれば目的は消える。

Hidenoriさんの判断はより深い依存関係を捉えている——**供給者としての責任は、自分がその供給物を実際に使い続けることによってしか担保されない**。`japan-geotiff-dem` が上流の日本データ供給源になった以上、`latest_file_list.csv.gz` は外部との契約である。契約を安定して履行するには、その出力を自分自身のパイプラインで消費し続け、壊れていないことを実地で確かめ続ける必要がある。2号以降を回すことは、上流のために作る作業であると同時に、**上流への供給物を検証する作業でもある**。

作るのをやめれば、公開しているものが正しいかどうかを誰も確かめなくなる。これはコードからも git 履歴からも導けない、プロジェクトの立ち位置に関する判断であり、将来のセッションが「上流が追いついたのだから畳めばよい」と早合点しないために明示的に記録する。

### 付随する指示

1. **上流貢献(海岸線のerosion-gateバグ修正、`1b6e4e1`/D114(B)/D116)は「Noted、いつか狙う」**——急がない。日本固有ではない汎用の正しさの問題で、合成テスト(海岸/継ぎ目治癒/全nodata)と実データ無回帰(江田島・長崎半島でビット一致)の両方の証拠が既に揃っている点は、将来PRを出すときの強みとして記録しておく。
2. **小口の整理4件は2号ローンチ以前に済ませる**——古い上流クローン `github/mapterhorn`(123MB)、`START_HERE.md` の機材表のstaleness、`check_disk_headroom.py` の閾値、公開スクリプトのtransfer-then-delete化。`PLAN.md` §8にチェックリストとして転記済み。

### 記録した成果物

この棚卸し自体は Artifact として整理した(リポジトリ地図・データフロー図・機材の役割・経緯の年表・取り込み候補のA/B/C/D分類・上流貢献候補の優先順位)。ただし**その中の「提案する次の一手」はこのD160で覆されている**——Artifactを後から読む場合はこの点に注意。

### Resume prompt

> D160: プロジェクト全体の棚卸しで、上流(`mapterhorn/mapterhorn`)の`jpdem1a`がOliverの新設した`wipfli/japan-download`経由で**こちらの`japan-geotiff-dem`公開物と同一の源泉**に繋がったことが実測で判明(291,779件のファイル名集合がMD5レベルで完全一致)。エージェントは「ブリッジは2号なしで退役できるのでは」と提案したが、**Hidenoriさんの判断で2号は継続**——`latest_file_list.csv.gz`を上流への供給契約として安定履行するには、自らそれを消費し続けて検証する必要がある、という理由。上流貢献(erosion-gate修正)は急がず「いつか狙う」。小口の整理4件は2号ローンチ前に片付ける(`PLAN.md` §8にチェックリスト化済み)。**次のアクション**: D155/D157の公開転送完了を待つ。その後は2号launch前の小口整理と、`PLAN.md` §8の残る⚠️項目(5m/10m破損チェック、dirty-tracking設計判断)。


## D161: D155(丸め上限1m)・D154(lineage修正)のstars公開完了・実地確認クリーン。小口整理3件も同時に完了

**Status**: Recorded, 2026-09-11 08:20 JST頃。D148/D153に続く3回目の再生成・再公開サイクルが完走した。

### 公開作業

Hidenoriさんの承認を得て、D142/D145/D153と同方式(delete-then-transferパターン)でstarsへ公開した。スクリプトは`/tmp/publish_d155_d157.sh`(`publish_d148_d152.sh`を踏襲)、`screen publish_d155_d157`で実行。

- **着手 02:05:06 JST、完了 08:17:36 JST、所要6時間12分**(D153の6時間12分とほぼ同一、平均11.0MB/s)
- elevation 258,141,372,680バイト・lineage 204,702,258バイトとも転送完了、**stars側のファイルサイズ・mtimeが送信元と完全一致**
- stars側`pmtiles verify`両方パス → アトミックリネーム → `systemctl --user restart martin` まで完走、EXIT_CODE=0、エラーなし

### 実地確認——「対にして見る」ことで初めて確定する検証

D153の記録値と既知座標のバイト数を比較した。**判定基準を実行前にスクリプト内へ書き込んでから実行**しているため、結果が期待を裏切った場合に気づけるようにしてある(`/tmp/spotcheck_d155.sh`)。

| 確認項目 | 事前予測 | 実測 | 判定 |
|---|---|---|---|
| elevation TileJSON | z0-16・全球bounds | z0-16・全球・center(140.9,41.85,12) | ✅ z0-7接合が反映 |
| elevation z13/6894/3521(与那国、**aggregation層**) | 64,276バイトのまま**不変** | **64,276バイト** | ✅ 完全一致 |
| elevation z8/219/101(対馬・五島、**downsampling層**) | 約+65%(≈102KB)に**増加** | **103,546バイト**(61,812から+67.5%) | ✅ 予測レンジ内 |
| lineage TileJSON | minzoom=4 | minzoom=4・maxzoom=16 | ✅ D146拡張が健在 |
| lineage z8/219/101 | 490バイトのまま**不変** | **490バイト** | ✅ 完全一致 |
| lineage z7/109/50(D154が書き換えた層) | HTTP 200・実データ | 200・206バイト | ✅ |
| lineage z5/27/12(D146の低ズーム) | HTTP 200・実データ | 200・2,648バイト | ✅ |

**この検証の要点は、z13とz8を対にして見たこと**。D155の変更(丸め上限32m→1m)は「z≤10の層だけに効く」はずのもので、その根拠はaggregation層の全6,373アイテムがネイティブmaxzoom≥12であること(D155で実測)だった。

- z13単体が不変でも「再生成が効かなかった」可能性を排除できない
- z8単体が増えても「意図しない層まで書き換えた」可能性を排除できない
- **両方を同時に見て初めて**、「狙った層だけが変わった」ことが確定する

片方だけでは区別のつかないものを、もう一つの観測を並べることで区別可能にする——同日にD157の対応として`check_disk_headroom.py`へ入れた改良(空き容量にscratch木のサイズを併記する)と同じ構造であり、starsセッションが同日に自分側で潰した死角(「ディレクトリ自動検出のソースは、実体が消えるとカタログからも同時に消えるので突合では検出できない」)とも同型だった。

なお低ズーム座標の選定では最初`z5/13/6`を使って空タイル(HTTP 204)を引いた——`mercantile.parent()`で`z8/219/101`の実際の祖先(`z5/27/12`・`z7/109/50`)を計算し直して修正した。任意の低ズーム座標では「配信されている」ことの証明にならない。

### 小口整理3件も完了(2026-09-11、D160の指示による)

`PLAN.md` §8のチェックリストのうち3件を、公開の待ち時間に処理した。

1. **`START_HERE.md`の機材表**(commit `1471c53`): `optgeo/japan-geotiff-dem`の所在をaalto→slateに修正。あわせて**D156の原因になった断定**(「Everything computational happens on slate **over SSH**」)を「まず`hostname`で確認せよ」という形に書き換え、ディスクを`diskN`ではなくマウントポイントで呼ぶよう明記(D158でdisk6→disk4に変わった実例つき)。原因になった記述自体を直さなければ同じ事故が再発する。
2. **`check_disk_headroom.py`の閾値と可視化**(`hfu-mapterhorn` commit `216fb22`): 既定を警告200/critical 80GB → **300/120GB**へ。根拠は1.5号の実成果物から逆算した実測値(merge 237.4GiB in→out、splice後240.4GiB)で、コード内コメントに明記した。あわせて**圧迫時にscratch木のサイズを併記**する機能を追加——D157の真因(孤立scratch 578GB)はボリューム単位の空き容量だけでは実データと区別できず、警告できなかったため。
3. **古い上流クローン`github/mapterhorn`の削除**(commit `539f6fc`、Hidenoriさんの承認済み): 123MB、最終フェッチ2026-06-10。未コミット変更・未pushコミット・stashのいずれも無く、remoteが到達可能で再クローン可能なことを確認の上で削除。**以後、上流の内容が必要な場合は`hfu-mapterhorn`の`upstream` remote(`git fetch upstream`)が唯一の正しい参照経路**。

**副産物: 上の(2)が同日中に別の残骸を掘り当てた。** 新しいscratch可視化を有効にした最初の実行で、`pmtiles-store/tmp-store/go-cli-scratch/`に**765GiBの孤立ファイル7件**(9/6・9/8・9/10のcluster/merge由来、最大311GB)が判明。`pmtiles` CLIが1つも走っておらず`lsof`でも誰も掴んでいないことを確認し、Hidenoriさんの承認を得て削除——`/Volumes/pmtiles-store`の空きが**569Gi → 1.3Ti**になった。D157の教訓として入れた機能が、入れたその日に効いた形になる。

**残る1件**は「公開スクリプトのtransfer-then-delete化」(D159)。今回の公開が現行スクリプトで進行中だったため触らず、**2号の公開スクリプトを書く時点で適用する**。

### starsセッションとの連携

転送中、starsセッションから「mapterhorn-japan-bridge.pmtiles が消えている」という問い合わせがあった(先方が同日に作った日次諸元ダッシュボードの初回実行が、ちょうど転送の谷に当たった)。転送中である旨・ETA・順序変更で今後は消失時間帯が無くなる旨を伝え、先方でも実体(`.mapterhorn-japan-bridge.pmtiles.new.X4qqja`)を確認して整合を取った。

この過程で先方は自身のインベントリが`*.pmtiles`しか見ておらず、転送中のステージングファイルが「消えた」としか読めなかったことを発見し、`staging`枠として別途収集・表示するよう修正した。**2号では順序変更と組み合わさって、「旧アーカイブは無事、隣で新版が育っている」と読める状態になる**——順序変更だけでは「消える窓がない」ことしか保証できないが、stagingが見えることで「今まさに差し替え中である」ことまで分かる。

### 現在の状態

**D155/D154のサイクルは完了。** stars上の公開データは丸め上限1m版のelevationとall-nodata-skip修正済みのlineage。1.5号(`01M1MKD73P0KDT719H21NJV9VR`)の成果物として、これが現時点の最終形。

### Resume prompt

> D161: D155(丸め上限32m→1m)・D154(lineageのall-nodata-skip修正)のstars公開が完了(02:05→08:17 JST、6時間12分、EXIT_CODE=0)。実地確認は全項目が事前予測どおりで、特に**elevation z13が不変(64,276バイト)・z8が+67.5%(103,546バイト)**という対の観測により、丸め変更が設計どおりz≤10の層だけに効いたことを確定した。あわせて2号前の小口整理を3件完了(`START_HERE.md`のstaleness、`check_disk_headroom.py`の閾値+scratch可視化、古い上流クローン削除)——後者の可視化改良が同日中に765GiBの孤立scratchを掘り当て、これも削除して`pmtiles-store`が1.3Ti空きになった。**次のアクション**: 残る2号前タスクは「公開スクリプトのtransfer-then-delete化」(2号の公開スクリプト作成時に適用)と、`PLAN.md` §8の⚠️項目2件(5m/10m破損チェック、dirty-tracking設計判断)。2号自体はGSIの次回DEM1A更新待ち(2026-09-11時点で2026-07-31が最新のまま、想定は11〜12月)。

## D162: `PLAN.md`'s 5m/10m corruption-check item was stale — it had already been closed by D35 on 2026-08-25

**Status**: Fixed (documentation only, no code/pipeline change).

**Context**: While resuming from `HANDOVER.md`, a 2026-09-12 review of
the two remaining `PLAN.md` §8 "decision needed before 2号" items found
that one of them — "5m/10m corruption-bug-class question, never
tested" — was factually wrong. D35 (this file's own predecessor,
`DECISIONS0.md`) had already closed this exact question on 2026-08-25:
`screen_source.py` was run against the full `jpnational10`/
`jpnationalsea`/`jpnational5` corpora and found them unaffected by
D18's `gmldem2tif.rb` bug. `PLAN.md` §3/§8 simply never had this
closure folded back in, and the stale line survived unchanged through
at least three later `PLAN.md` edits (2026-09-06, 09-09, 09-11) without
anyone re-checking whether it was still true.

**Verification, not just a re-read of D35's prose**: the raw screening
outputs D35 describes are still on disk, untracked, in `hfu-mapterhorn`
(`pipelines/screen_results_jpnational{5,10,sea}.csv`, dated 2026-08-22
— these are the same files this repo's own `HANDOVER.md` already lists
as pre-existing untracked scratch to leave alone). Row counts and
zero-valid-pct counts were re-derived directly from these files and
matched D35's own numbers exactly: `jpnational5` 422,119 rows / 2,062
at 0% valid; `jpnational10` 4,981 rows / 0 at 0%; `jpnationalsea` 275
rows / 0 at 0%. No decode-error rows in any of the three. This is
independent re-confirmation against primary evidence, not just trust
in a prior session's own summary.

**Decision**: updated `PLAN.md` §3 and §8 to mark this item resolved,
with the verification numbers inline, and added a note in §8 warning
future readers to check a "still open" item's cited D-number before
trusting the checklist's own prose. Left §57's dirty-tracking design
question untouched — that one really is still open, no evidence found
that it was ever decided.

**A related, adjacent finding from the same review, also fixed**: the
sibling `japan-geotiff-dem` repo's own local clone on `slate`
(`/Volumes/Migrate-2025-04/github/japan-geotiff-dem-repo`) was itself
simply behind `origin/main` by about a month (last local commit
2026-08-14, `origin/main` actually at 2026-08-22's D18 entry) —
fast-forwarded, no conflicts, working tree was already clean. Separately
from that, `origin/main` itself stops at D18's "partially fixed,
investigation ongoing" state; the actual closure (D35, above) only
ever got written into *this* repo's docs, never back into
`japan-geotiff-dem`'s own `DECISIONS.md`/`HANDOVER.md`. Backfilled a
closing addendum there (D18's own entry) and a short HANDOVER.md entry
pointing back to D35, so a future session reading that repo in
isolation doesn't restart already-finished corruption-sweep work.

**Consequences**: no pipeline or data change — this was a pure
documentation/consistency fix. The practical effect is that PLAN.md
§8's 2号-readiness checklist now has exactly one genuinely open item
(D57's dirty-tracking design question) instead of two, and a future
session won't waste time re-litigating a question already answered
three weeks ago. Worth remembering as a pattern: a checklist item's
own cited decision number is the thing to re-check, not just its
prose — the prose can (and did) survive unchanged long after the
decision it describes was resolved.

## D163: D57's dirty-tracking redesigned safely and implemented — MD5-backed cross-generation reuse for `aggregation_covering.py`

**Status**: Implemented and tested at small scale (`hfu-mapterhorn`
`utils.py`/`aggregation_run.py`/`aggregation_covering.py`, plus a new
one-off `backfill_aggregation_md5_fingerprints.py`). Not yet exercised
at national scale — that only happens for real once 2号 actually
launches and its `aggregation_covering.py` run compares itself against
1.5号 for the first time. Hidenori's own framing for this session:
"2号ローンチへのリードタイムを活用すべき時だ。急がず慌てず確実に" —
this is exactly that lead-time work, done carefully rather than under
launch pressure.

**Context**: D57 (2026-08-29) ripped out `aggregation_covering.py`'s
original cross-generation dirty-filter after finding it silently
skipped 2,343 positions that the *previous* generation itself had never
finished building — `pmtiles-store` was flat at the time, so "unchanged
since Kyushu" inherited Kyushu's own incomplete positions forward
forever. The fix made every generation reprocess everything from zero
(safe, but sacrifices the ~2/3-unchanged efficiency D42's own estimate
implies a real GSI update cycle should allow), and explicitly flagged a
"safer version that also verifies the referenced output actually
exists" as a real design question for 2号, not solved that night.

D162 (this session, same review pass) found this was still genuinely
open — unlike the 5m/10m item next to it in `PLAN.md` §8, nobody had
quietly closed this one. Hidenori's decision, asked directly: implement
the safe design now, reusing D119/D120's `.done`-manifest fingerprint
machinery (already proven in production for `downsampling_run.py`'s own
freshness checks) rather than reinventing dirty-tracking from scratch.

**A second gap found while designing, before any code was written**:
comparing aggregation.csv content alone (filename + maxzoom, the
original D57-era approach) cannot detect the exact failure class D18/
D35 already produced once in this project's own history — a source
file whose name AND byte size stay identical but whose actual content
silently changes (a corruption fix). `aws s3 sync --size-only` would
have missed exactly this in D35's own account. Confirmed with Hidenori
before scoping the implementation: yes, close this gap too, using each
source's own manifest MD5 (`source-catalog/{source}/file_list.csv[.gz]`,
D14's `url,size,md5` columns) as the real content fingerprint, not
filename/size.

**Design** (`hfu-mapterhorn` pipelines):

1. `utils.get_source_md5_map(source)` — `{filename: md5}` for one
   source, read via the existing `open_manifest()` helper (D14/D26,
   reused rather than reimplemented), memoized per process (a national
   run looks this up per source file per aggregation item; jpnational1
   alone is 291,779 rows).
2. `utils.md5_input_entries_for_aggregation_csv(filepath)` — one
   fingerprint entry per (source, filename) referenced by a covering
   CSV, each `{'path': f'{source}/{filename}', 'md5': ...}`. A lookup
   miss produces an explicit `{'missing': True}` entry rather than
   silently omitting the file, so a stale/incomplete manifest can never
   look like a match by omission.
3. `utils.compute_inputs_fingerprint()` extended with an `elif 'md5' in
   e:` branch (additive; every existing `sha256`/stat-based caller is
   unaffected).
4. `aggregation_run.py`'s `run()` now includes these MD5 entries
   alongside the existing covering-CSV content entry in every NEW
   item's own `.done` manifest, going forward, at zero extra ops cost
   (this is just what the code does by default from now on).
5. `aggregation_covering.py`'s `write_aggregation_todos()` gets a new
   `try_reuse_from_previous_generation()` step per item, checked BEFORE
   falling back to writing a `.todo`. It requires ALL of: an equivalent
   item exists in the previous generation with a `.done` manifest
   certifying every required datatype; today's fingerprint (covering
   CSV content + every referenced file's current MD5) exactly matches
   what that manifest recorded at build time; and the previous
   generation's own pmtiles-store output file actually exists on disk
   for every required datatype (D57's own explicit "verify existence,
   don't trust the marker" requirement). On success it COPIES the
   previous generation's file(s) into the CURRENT generation's own
   generation_id-scoped folder and writes a FRESH `.done` manifest
   there (with a `reused_from_generation_id` marker for auditability) —
   never a bare cross-generation skip. This is the load-bearing
   difference from the pre-D57 code: after this, the current generation
   owns a real file and a real marker, indistinguishable from a
   genuine build to every other tool in the pipeline, and immune to
   D69's stale-marker failure mode (no other generation's run can ever
   rename/delete a file out from under a *different* generation's own
   folder — that per-generation isolation already exists since D95/
   D124, this just makes sure reuse never creates a cross-generation
   pointer that could dangle).
6. `backfill_aggregation_md5_fingerprints.py` (new, one-off but kept as
   a committed tool, dry-run by default) — retrofits the MD5 entries
   above onto an ALREADY-BUILT generation's existing `.done` manifests
   (they predate this fingerprint and have nothing to compare against
   otherwise). Applied to 1.5号 (`01M1MKD73P0KDT719H21NJV9VR`, all
   6,373 items) this session. Preconditioned on verifying, before
   running, that no source manifest (`jpnational1`/`5`/`10`/`sea`) had
   regenerated since 1.5号's own aggregation build (D132, 2026-09-04/05)
   — confirmed via `git log`/`stat` (jpnational1 last regenerated
   2026-08-25 per D18's own closing fixes; 5/10/sea all Aug 19-21) —
   so today's MD5 for any of these files is provably the same MD5 that
   was true when 1.5号 actually consumed it. This step is what makes
   2号's own future comparison against 1.5号 possible at all; without
   it every item would (safely, just wastefully) fall through to full
   reprocessing since 1.5号's original manifests have nothing to
   compare against.

**A real bug caught during design, before any code ran — worth keeping
as its own lesson**: the first draft used each item's real on-disk
`filepath` (e.g. `aggregation-store/01M1MKD73P0KDT719H21NJV9VR/{filename}`)
as the covering-CSV fingerprint entry's own `path` field, copying the
existing `content_input_entry()` convention verbatim. Since that path
string embeds the generation_id, two byte-identical CSVs in two
different generations would have recorded two DIFFERENT fingerprint
entries purely from the path text differing — `inputs_fingerprint`
would never match across generations even for genuinely-unchanged
content, silently defeating the entire feature (always falling through
to full reprocessing, never loudly wrong, just permanently useless).
Fixed by adding `content_input_entry(path, canonical_path=None)` —
callers doing cross-generation comparison pass `canonical_path=filename`
(generation-agnostic), so the same item hashes identically in any
generation. `aggregation_run.py`'s own manifest-writing call was updated
to use this too, so every future generation's own manifest is written
in the comparable form from the start.

**Verification, real code against real 1.5号 data, in an isolated test
generation directory (`aggregation-store/00TESTGEN163...`, deleted
after each check, never touching 1.5号's own files)**:

| case | setup | expected | actual |
|---|---|---|---|
| pre-backfill negative | unchanged item, 1.5号 manifest not yet MD5-backfilled | reuse fails (no fingerprint to compare) | ✅ `False`, no side effects |
| post-backfill positive, single-source | unchanged item (`jpnationalsea`, 1 file) | reuse succeeds | ✅ `True`; copied file byte-identical (md5 match); fresh manifest with `reused_from_generation_id` |
| content-changed negative | same position, maxzoom edited 12→13 | reuse fails | ✅ `False`, no side effects |
| **D18/D35 scenario** | identical covering CSV text, but the referenced source file's MD5 forced to a fake different value | reuse fails | ✅ `False` — this is the specific gap the whole MD5 layer exists to close, confirmed closed |
| large multi-source item | 1,290-file `jpnational1` (1m) item | reuse succeeds | ✅ `True` |
| multi-datatype | `EMIT_LINEAGE=1`, both elevation+lineage required | both files copied, both certified | ✅ verified both paths on disk |

After every test, the test generation directory (both `aggregation-
store/` and `pmtiles-store/{elevation,lineage}/`) was deleted, and
1.5号's own real `.done`/`.csv`/`.pmtiles` files were confirmed
byte-unchanged (MD5 spot-check before/after) and count-unchanged
(6,373/6,373/0 csv/done/todo, same as before this session touched
anything).

**Expected payoff, from D132's real measurement**: 1.5号's own full
national aggregation (6,373 items, 3 workers) took ~31.5 hours wall
clock. D42's own estimate (~1/3 of positions actually change per real
GSI update cycle) implies 2号 could see roughly that fraction of items
fall through to full reprocessing and the rest reused in a few minutes
each (a copy + a manifest write, not a re-aggregation) — very roughly a
same-order-of-magnitude reduction, though the true number depends
entirely on how much of Japan's 1m/5m/10m/sea coverage genuinely
changes in the next real GSI update, which is not knowable until 2号
actually runs its own fresh covering.

**Deliberately not done this session**: a full-scale rehearsal against
a synthetic "3rd generation" spanning all 6,373 items (would require
either faking a full covering or waiting for a real one) — the small-
scale tests above exercise every distinct code path (positive, negative,
the specific D18/D35 case, multi-file, multi-datatype) with real
production data, which is the proportionate amount of verification for
work that won't actually run at full scale until 2号 itself launches,
per Hidenori's own "急がず慌てず確実に" framing rather than either
rushing to "done" or over-building a synthetic full-scale harness for a
launch that is still GSI-gated and months out.

**What 2号 itself should do differently from 1.5号 because of this**:
nothing operationally — `aggregation_covering.py`'s own `main()` is
unchanged in its calling convention, so 2号 launches exactly as
documented in `PLAN.md`/`CLAUDE.md` today. The only visible difference
will be `write_aggregation_todos()`'s new summary line reporting how
many items got reused vs. queued, and (if reuse works as designed) a
meaningfully shorter aggregation wall-clock time than 1.5号's own 31.5
hours. Worth watching that summary line specifically when 2号 actually
runs, and treating a reuse count near zero as a signal to investigate
(most likely explanation: the MD5-backfill precondition -- no source
manifest changing since 1.5号 -- no longer holds by the time 2号
starts, which is expected and fine, just means less reuse than hoped,
not a bug) rather than assuming the feature itself is silently broken.

## D165: Opus review of the full production pipeline -- 10 confirmed findings, 4 fixed (including a live data-quality bug), 6 tracked for follow-up

**Status**: 4/10 fixed and tested against real data, 2026-09-13. The
remaining 6 are real, verified findings, deliberately NOT rushed --
see each one's own reasoning below for why.

**Context**: Hidenori's own explicit sequencing for this session --
"Claude review clears first, then an independent Opus review, then a
2号 dress rehearsal only once bug-squashing feels thorough" (verbatim
framing, 2026-09-13). D163/D164 closed the Claude-review stage (safe
cross-generation reuse + a self-review pass, 10 issues found and
fixed). This entry is the Opus stage: a fresh, from-scratch review
(not limited to D163/D164's own diff) of the entire production chain
that will run during 2号 -- `source_download.py` through
`bundle.py`/`merge_japan_bundles.py`, all of `utils.py` -- specifically
briefed to hunt for NEW instances of this project's own three
dominant historical bug classes (silent data loss from unsafe "already
done" checks -- D51/D57/D69/D74-D76; non-atomic writes mistaken for
complete -- D120#4/D164; namespace collisions -- D74-D76) rather than
generic bugs. `ReportFindings` wasn't available inside the delegated
agent, so its 10-finding list was re-entered into this session's own
`ReportFindings` call by hand after the fact (all still logged as
CONFIRMED/PLAUSIBLE there).

### Fixed and tested this session

**#1, MOST IMPORTANT -- already live in the published 1.5号 archive**:
`aggregation_merge.py`'s `merge()` zero-filled every nodata pixel
unconditionally, on both its single-group and multi-group code paths,
before `aggregation_tile.py` ever saw the data -- so the `valid_mask`/
alpha mechanism (`utils.save_terrarium_tile()`'s own docstring: built
specifically so "gaps ... survive as nodata through downsampling's
tile pyramid, instead of silently becoming a fake elevation of 0m")
was always fully opaque. Verified live by the Opus review: 315/315
sampled 1.5号 elevation tiles decode with no alpha plane at all; a
519-tile sample found 5.59% of leaf pixels affected; a specific tile
(`12-3674-1521-12.pmtiles`) confirmed against its own lineage sibling
-- 262,144/262,144 no-source-coverage pixels in lineage, the
byte-identical position in elevation a fully-opaque tile of exactly
0.0m.

**Root cause, traced back through git history**: the unconditional
`-9999→0` fill was added by `1b6e4e1` ("Fix D114(B): boundary_tile
erosion-gate deleted coastal transitions") specifically to stop a much
more visible "hard cliff" bug (raw -9999 surviving into Terrarium
encoding decodes as a wildly wrong elevation). That fix was correct
for its own problem -- verified at the time with a synthetic test
suite that no longer exists in the repo (not committed, per this
project's own established "one-off, not committed" pattern for
verification scripts) -- but never restored nodata semantics
afterward, since doing so safely requires knowing exactly which pixels
the fix's own gaussian blur touched, and the original fix didn't need
that distinction for its own purpose.

**Fix**: snapshot `never_covered_mask` (pixels no group ever filled)
immediately before the zero-fill (which is still needed, numerically,
for the gaussian blur math -- a filter can't operate on a -9999
sentinel sensibly). After the blur runs, restore -9999 only where
`boundary_tile_blurred == 0` -- i.e. pixels the blur's gaussian kernel
made literally zero numerical contribution to, meaning genuinely
outside its reach. Pixels the blur DID touch (D114(B)'s own coastal
transition zone) keep their blended value exactly as before, untouched
by this change. When no blur ran at all (a window with zero coverage
from any group), everything `never_covered_mask` marks is restored
directly. The single-group branch (no blur math there at all --
"nothing else to blend against") simply had its zero-fill removed
outright, since there was never a numerical reason for it.

**Verification, since D114(B)'s own original synthetic suite no longer
exists**: built a fresh synthetic scenario replicating it exactly (a
coastline where a higher-priority source stops partway and a
lower-priority source extends slightly further, both leaving deep
"open ocean" pixels uncovered) -- confirmed the coastal-blend values
(x=32 through x=51 in the test, decaying smoothly toward numerical
zero) are byte-identical before and after this fix, while pixels
beyond the blur's numerical reach (x≥52) now correctly read -9999
instead of a flat 0. Also tested the all-uncovered-window edge case
(both groups entirely -9999 → output entirely -9999, previously
entirely 0). Re-ran real 1.5号 source-only items through the fixed
`merge()`: found several `jpnationalsea`-only items where the fix
activates at real national scale, one going from 0% to 97.4% nodata
(a mostly-open-ocean macrotile off Hokkaido's Pacific coast, the
remaining 2.6% correctly real Copernicus 0m values, not corrupted).
`aggregation_tile.py` itself needed zero changes -- its own
`valid_mask = subdata != -9999` logic was already correct, just
starved of real -9999 input by `merge()`.

**#4**: `utils.read_done_manifest()` treated ANY corrupt/truncated
`.done` JSON identically to a genuine pre-D119 legacy marker (`{}`),
so `done_covers()`/`done_is_current()` both certified it "done,
current" for elevation with zero verification -- and `write_done_
manifest()` has no `fsync` anywhere in this codebase (only
tmp+`os.replace`, which guarantees ordering, not durability), so a
crash mid-write plausibly produces exactly this. Fixed by
distinguishing a REAL legacy marker (always exactly 0 bytes, from a
bare `touch`) from a corrupt one (non-empty but unparseable or wrong
format) -- the latter now returns a distinct `False` sentinel that
`done_covers()`/`done_is_current()` never trust. Verified: a 0-byte
file still reads as `{}` (elevation-only, backward compatible); a
truncated-JSON file now correctly fails both checks. Also directly
strengthens D163/D164's B1 fix (the legacy-manifest guard in
`try_reuse_from_previous_generation()`), which already used the same
truthiness check and now correctly rejects corrupt manifests too, not
just empty ones.

**#2 (partial)**: `lineage_provenance.py`'s `compute_provenance()` used
an unguarded `glob(f'{tmp_folder}/*-3857.tiff')` that also matches
`merged-3857.tiff` on a crash-and-resume -- the exact D48 hazard
`aggregation_merge.py`'s own glob was already narrowed to avoid,
copied here before that narrowing existed. Fixed by matching the same
`[0-9]*-3857.tiff` pattern. **Deliberately NOT fully fixed**: a deeper
resume-safety gap remains -- `reproject()`'s own early-return (skips
if `reprojection.json` exists) means the per-group tiffs are never
regenerated on resume either, so if `run()` crashes after `merge()`
has already consumed them but before the item's own `.done` gets
written, `emit_lineage()` now raises a clean `ValueError` instead of
silently miscounting, but still has no real inputs to recover from.
Making the whole reproject→lineage→merge→tile chain safely resumable
at any crash point needs its own design pass (each stage would need to
record enough to skip correctly or regenerate what a later stage
consumed) -- a rushed patch here (e.g. "just skip lineage if merge-done
exists") risks silently certifying an item's lineage as done when it
was never actually computed, exactly the class of bug this whole
review exists to catch. Documented in a new comment on `emit_lineage()`
itself so a future session doesn't have to re-derive this.

**#9**: `aggregation_covering.py`'s `write_aggregation_todos()` ignored
the `AGGREGATION_ID` override `main()` had just honored when minting a
covering, always re-deriving "newest generation on disk" instead of
the one actually being planned -- re-running covering against a
specific non-latest generation (e.g. to re-plan it after a source
repair) was a silent no-op for that generation while an unrelated,
actually-newest generation got its `.todo`/`.done`/reuse-copies
churned instead. Fixed: `write_aggregation_todos()` now takes an
explicit `aggregation_id` parameter (default `None` preserves the old
re-derive behavior for standalone/backward-compatible invocation);
`main()` passes its own resolved id. Verified with a 3-generation
test (oldest=A, target=B, unrelated-newest=C all present on disk):
calling `write_aggregation_todos(aggregation_id=B)` correctly reused
from A and left C completely untouched.

### Tracked for follow-up, not fixed this session

Each of these is a real, CONFIRMED (or one PLAUSIBLE) finding --
deferred for scope/depth reasons, not doubt about whether they're
real:

- **#3**: `aggregation_run.py`'s own `.done` check uses `done_covers()`
  (no freshness check, never verifies the output file exists) instead
  of `done_is_current()` plus an explicit existence check the way
  `aggregation_covering.py`'s reuse path and `downsampling_run.py`
  both already do. Latent today (audited live: 1.5号 is 6,373/6,373
  `.done` with 0 missing outputs, 0 legacy/corrupt manifests) but a
  real gap for 2号, where a source file could legitimately get
  corrected mid-run (the actual D18/D35 scenario) after this item's
  own `.done` already exists.
- **#5**: `downsampling_run.py`'s own freshness gate verifies its
  input children but never stats its own output file -- the manifest
  even records the output path (`extra={'output': out_filepath}`) and
  nothing ever reads it back. Same shape as #3, one layer up.
- **#6**: `lineage_provenance.py`'s `compute_provenance()` reads whole
  reprojected rasters into RAM unwindowed, where `aggregation_merge.py`
  processes the same data in 512px windows specifically to avoid this
  -- measured up to ~10.7 GiB peak for a single worker on the largest
  real covering items. Not fatal (1.5号's own lineage archive exists),
  but it's the exact mechanism D129/D130/D131 fixed `AGGREGATION_
  WORKERS` at 3 to avoid, landed in a code path that predates that
  fix and was never revisited against it. A real fix means rewriting
  `compute_provenance()`'s core loop around windowed reads -- more
  invasive than the fixes above, deferred rather than rushed.
- **#7**: `remove_dangling_pmtiles.py` classifies D146's entire
  standalone `0-0-0-{4..7}.pmtiles` lineage low-zoom pyramid as
  dangling, since those files have no covering CSV by design (that
  standalone script's whole point). Running the documented cleanup
  tool after a 2号 lineage pass would delete that whole feature.
  Needs the tool's own `expected_pmtiles_filenames` set taught about
  this one deliberate exception -- straightforward, deferred only for
  time this session, should be picked up before it's ever run against
  a post-2号 lineage generation.
- **#8**: `downsampling_run.py`'s own tmp folder
  (`{z}-{x}-{y}-{pz}-tmp`) is the one shared path in the D107
  datatype-separation restructure that never got scoped by datatype --
  both elevation and lineage downsampling passes would write
  identically-named files there if ever run concurrently (nothing in
  the code prevents that; only convention does).
- **#10** (PLAUSIBLE, not CONFIRMED): `aggregation_covering.py`'s
  `write_aggregation_items()` never removes a superseded covering CSV
  from a previous pass into the same generation, unlike its
  `downsampling_covering.py` sibling. Combined with `aggregation_
  tile.py`'s own stale-output cleanup glob, two same-position workers
  could in principle delete each other's output if a position's source
  composition (and therefore its `child_z`) changes between two
  covering runs into the same generation -- exactly 2号's own shape if
  more source data lands mid-generation. No duplicate position exists
  in any current generation (verified), so this is a real but
  currently-dormant risk, not an active one.

### What this means for the 2号 dress rehearsal

Per Hidenori's own framing: the dress rehearsal (and any "1.7号" full
re-publish that might follow it, reprocessing 1.5号's own source data
with all these fixes applied rather than waiting for 2号's fresh GSI
data) should wait until bug-squashing feels thorough, not just until
this one Opus pass is fully closed out. The 6 deferred items above are
the concrete remaining list -- #3/#5/#7/#8 are all reasonably
contained; #6 is a real rewrite; #10 needs either a fix or an explicit
risk-acceptance decision before 2号's own covering could plausibly be
re-run into an existing generation.

**Also verified as real by the Opus review but below its own top-10
cutoff, not yet triaged**: divergent copies of `get_worker_count()`'s
`Pool(processes=0)` guard (fixed in `aggregation_run.py` only, not
`downsampling_run.py`/`bundle.py`); a 533x redundant per-parent
recomputation in `downsampling_run.py`'s hot path (~0.9 CPU-hours
across 2号's two datatype passes); `downsampling_run.py --fix`/
`--regenerate` globbing across ALL generations rather than the one
being operated on; duplicated Terrarium-encoding logic between
`utils.save_terrarium_tile()` and `downsampling_run.py`'s own inline
version; several small dead-code items; Freetown-deployment defaults
(`CENTER_LAT`/`CENTER_LON`/`PRIORITY_MODE`) silently governing the
national runbook's own processing order since `CLAUDE.md`'s documented
commands never override them. None of these block a rehearsal on their
own; worth a lighter pass before or during it.

## D166: 1.6号 land-area maxzoom upsampling implemented, after a design review caught a catastrophic flaw in the original plan

**Status**: Implemented, design-reviewed, code-reviewed, tested against real 1.5号 data. Not yet exercised in a real national run — `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` is still empty pending 1.6号's own generation_id.

**Scope decision (Hidenoriさん, 2026-09-13)**: 1.7号は未発番のまま据え置く。当初想定していた流れ(「大改修→ドレスリハーサル→1.7号」)を「**大改修→アップサンプリング実装→ドレスリハーサル→1.6号**」に変更——1.6号という呼称自体は既にD149-151で使われていたものを正式な次の実launchの名前として確定し、番号を1つ増やさない。この記録の残りは、その流れの「アップサンプリング実装」部分の顛末。

### 経緯: 当初の設計案が壊滅的だった

D149-151(1.6号の当初設計、2026-09-07)は`downsampling_covering.py`の`get_extents_from_coverings()`が「アップサンプルされたz14-z16のリーフを一切発見できない」ことまでは正しく特定していたが、対処案(実ファイルグロブを追加、`utils.resolve_layer()`を位置だけで一致判定)は未実装のまま放置されていた。

このセッションで設計を詰め直す過程で、実装前にOpusへ設計レビューを依頼した——**これが致命的な判断ミスを未然に防いだ**。Opusが実データで検証した結果:

- 「`resolve_layer()`を位置だけで一致判定」という当初案は、**1.5号の実データだけで(アップサンプル無関係に)全参照14,489件中7,226件(49.9%)の判定を変え、8,223件中4,553件のdownsamplingアイテムに影響する**ことが判明。原因: leafの位置と、そのleafから再帰的に構築されたoverviewは、ピラミッド構造上**同じ(z,x,y)に異なるchild_zで正当に共存する**(実データで3,344/6,373ポジションがこれに該当)。「1ポジションにaggregation.csvは高々1つ」という前提の後半(「child_zは位置の識別子の一部ではない」)が誤りだった。
- D163/D164の世代間再利用機構についての当初の安全性判断も**向きが逆**だった。1.6号(アップサンプル世代)は1.5号(非アップサンプル)の直後に来るが、covering CSVの中身(`source,filename,maxzoom`)はアップサンプルしても変わらないため、フィンガープリントが一致し、**再利用機構が1.5号の非アップサンプル出力を1.6号にそのままコピーしてしまう**。対象2,128件中1,974件がmacrotile_z上限のz12にあり、粒度変更をしてもファイル名が変わらないため、この再利用ハザードは常に発動し、1.6号は主要な対象アイテムに対して何もせず終わるところだった。

このAsk-before-code方式(設計→Opusレビュー→修正→実装→Opusコードレビュー→実データ回帰テスト)がHidenoriさんの明示的な指示であり、まさにその通りに機能した。

### 修正した設計

`FLAT_LEGACY_GENERATION_ID`と同じパターンで、世代IDキー付きポリシーテーブル`utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION`を導入。「アップサンプルが有効かどうか」はcoveringの中身では判別できない世代ごとのポリシーであり(同じcoveringでも1.5号と1.6号で判定が変わるべき)、env varのような揮発性の切り替えではなく、データについての恒久的な事実として世代IDに紐付ける。

中核: `utils.leaf_child_z(aggregation_id, z, x, y)` — coveringの中身とこのポリシーテーブルだけから計算する**純粋関数**(pmtiles-storeの実ファイルスキャンではない——Opusの設計レビューが指摘した通り、実ファイルスキャンだと「aggregation未完了のリーフがプランから静かに消える」「世代間でchild_zが変わった際に古いdownsampling出力が残る」という新たな問題を生む)。これを`resolve_layer()`・`get_extents_from_coverings()`・`remove_dangling_pmtiles.py`・D163再利用フィンガープリント・`check_stale_duplicates_v2.py`の5箇所全てで共有。`aggregation_tile.py`/`lineage_tile.py`には「実際のラスタから計算したchild_zが`leaf_child_z()`の予測と一致するはず」というhard assertを追加——これが仕組み全体の安全弁。

### 実装・検証(実データ)

- `resolve_layer()`新旧比較: 1.5号の実参照14,489件、差分0件(修正前後で完全一致)。
- `get_extents_from_coverings()`新旧比較: 隔離コピー上で`write_downsampling_items()`を新旧両方実行、8,223/8,223件のdownsampling.csvが完全一致(ファイル名・内容とも)。
- 実際のアップサンプル: 与那国島の実アイテム(`11-1727-881-13`、native z13、D150のリハーサルと同一アイテム)を本番コードパスでz16まで実際にアップサンプル。標高最大311.67m(D150のリハーサル値312mとほぼ一致)。
- 再利用拒否の3シナリオ全て実データで確認: (A)前世代に記録なし→拒否、(B)前世代がnative記録・現世代がアップサンプル要求→拒否(まさに修正対象のハザード)、(C)海域限定アイテム→現世代がアップサンプル世代でも正常に再利用。
- `remove_dangling_pmtiles.py`: 修正前は1.5号で4件(D146のlineage低ズームピラミッド)を誤検出、修正後0件。

### Opusによる実装コードレビューで判明した7件の追加問題(全て修正・再検証済み)

1. `leaf_child_z()`が`reproject()`の`target_zoom > maxzoom`ガードを持たず、ポリシーテーブルの値が既存のnative解像度を下回る設定だと両者が食い違いうる→`max(native, target)`相当のガードを追加。
2. 同一世代内に重複coveringが存在する場合(dormant、今日は未発生)、`get_leaf_child_z_map()`が黙って1つだけ残す設計になっており、`remove_dangling_pmtiles.py`が正当なリーフを削除しうる→検出したら例外を投げる設計に変更。
3. **`aggregation_run.py`の同一世代内`.done`スキップが`leaf_child_z`を確認していなかった**——ポリシーテーブルへの世代ID追加が(そのIDが既に存在する必要があるため)「世代ミント→ポリシー追加」という順序になりがちで、その間にビルドされたアイテムが永遠にアップサンプルされずスキップされ続ける実害あるバグ。修正し、実際にそのシナリオを再現して正しく再ビルドが強制されることを確認。
4. `remove_dangling_pmtiles.py`のD146除外条件が`< 8`をハードコードしていたが、`lineage_extend_low_zoom.py`のズーム範囲は環境変数で変更可能→実際の`.done`マーカーから読むよう修正。
5. backfillスクリプトがポリシーテーブルの予測を無検証で書き込んでいた→実ファイルの実在確認を追加。
6. backfillスクリプトの成功カウンタが書き込み前にインクリメントされており、書き込み失敗時に二重計上されうる→書き込み成功後にインクリメントするよう修正。
7. `check_stale_duplicates_v2.py`(`--aggregation-id`引数を取る、真に汎用的な監査ツール)が素朴なファイル名パースのままだった→`utils.get_leaf_child_z_map()`を使うよう修正。

**見送った項目(理由付きで記録)**: `check_covering_gaps.py`は1号の生成IDにハードコードされた歴史的な一回性ツールで、1号が今後`LAND_UPSAMPLE_ZOOM_BY_GENERATION`に入ることはないため実害なし。`is_land_item_covering()`の非ショートサーキット(実測約1秒/プロセスの無駄、正確性には無関係)。アップサンプルで一部アイテム(5件)が32768×32768pxのワープに達する点(1.5号の既存231件の同規模アイテムが3ワーカーで実際に完走済みなので許容範囲内と判断、ただし打ち上げ前に意識的な確認は必要)。

### 現在の状態・次のアクション

コードは実装・レビュー・実データ検証済みだが、`LAND_UPSAMPLE_ZOOM_BY_GENERATION`は空のまま——1.6号自身のgeneration_idがまだ発番されていない。次に必要なのは:
1. 1.6号のgeneration_idを発番し、`PLAN.md`の世代表に記録した上でこのテーブルに追加(このタイミングを間違えると項目3のハザードを踏む——**ID発番とテーブル登録は同じタイミングで行い、ビルド開始前に完了させること**)。
2. 「陸域か」の判定(`is_land_item_covering()`)・target zoom(16)を実際の1.6号本番runで通す。
3. ~~D165で見つかった残り6件~~ → **D167で全件解消(2026-09-14)**。
4. その後、ドレスリハーサル・ウェットドレスリハーサルを経て1.6号を本launchする、というのがHidenoriさんの指示した流れ。

## D167: D165's remaining 5 findings (#3/#5/#6/#8/#10) fixed and verified against real data -- one of them (#10) had a critical regression caught by Opus code review before it ever ran

**Status**: All 5 fixed, each verified against real 1.5号 data or a synthetic scenario built from real code paths. Opus code review requested on the diff before considering this closed, per Hidenori's own standing "review before trusting a nontrivial pipeline change" practice (validated twice already this session for D166) -- this is the third validation, and it caught a real, severe bug.

**Context**: D165 (2026-09-13) fixed 4 of 10 findings from an Opus review of the full production pipeline and deferred 5 (#3, #5, #6, #8, #10; #7 was fixed separately as part of D166's own code-review pass). This entry closes all 5, ahead of 1.6号's dress rehearsal, since Hidenori's own gating condition for the rehearsal was exactly this list.

### Fixes

**#3** (`aggregation_run.py`, `run()`): the per-item `.done`-skip check used to call only `utils.done_covers()` -- confirms the marker claims the right datatypes, nothing about freshness or whether the output file is still on disk. Changed to compute this item's fingerprint `entries` up front and require `utils.done_is_current(done_path, required_datatypes, entries)` (adds the D119 freshness gate) **and** `all(output_exists(dt) for dt in required_datatypes)` (a real `os.path.isfile()` check against the actual pmtiles-store path for every required datatype) before trusting the marker. The existing `leaf_child_z` manifest check (from D166) stays nested inside this stricter condition. `write_done_manifest()` further down now reuses the same `entries`/`child_z` values instead of recomputing them (verified nothing between the two uses could invalidate them). Verified against a real single-source (`jpnationalsea`) 1.5号 item run end-to-end through `aggregation_run.run()` inside an isolated fake generation_id: (a) first run builds and writes a real `.done`; (b) second run correctly skips (output untouched, same mtime); (c) deleting the output file forces a rebuild despite a "current" marker; (d) corrupting the recorded `inputs_fingerprint` forces a rebuild too.

**#5** (`downsampling_run.py`, `main()`): the same shape one layer up. `done_is_current()` alone doesn't check that `out_filepath` (already computed earlier in the loop) is actually still on disk. Added `output_exists = os.path.isfile(out_filepath)` as an additional requirement to skip, and split the "stale, rebuilding" log message into "output missing" vs. "inputs changed" cases. Verified against a real 1.5号 downsampling item (`10-862-435-10-downsampling.csv`, referencing a real downsampling-layer overview file, not an aggregation leaf -- confirmed via `resolve_layer()`) inside an isolated fake generation_id, run end-to-end through `downsampling_run.main()`: same three-scenario pattern as #3, all correct.

**#6** (`lineage_provenance.py`, `compute_provenance()`): used to open every per-group reprojected tiff FULLY into a float32 array (measured ~10.7 GiB peak on the largest real 1.5号 items -- the exact `AGGREGATION_WORKERS=3` RAM ceiling D129/D130/D131 fixed elsewhere, in a code path that predates that fix and was never revisited). Rewritten to read every group in 512x512 windows, matching `aggregation_merge.py`'s own blocking, but with **no overlap margin** -- safe because this function has no cross-pixel operation at all (pure per-pixel nodata-fill priority walk), unlike `merge()`'s own windowed branch which needs overlap for its erosion+blur. This makes windowing provably result-preserving, not just probably. Verified two ways: (1) a real multi-source (5-group) 1.5号 item (`10-875-434-16-aggregation.csv`, reprojected fresh into an isolated tmp folder) run through both the old whole-raster implementation and the new windowed one -- **0 differing pixels out of 1,090,188,324** (a 33018x33018 raster); (2) an independent Opus re-verification against synthetic rasters at five different odd/edge shapes (513x700, 512x512, 1x1, 1025x1023, 300x1200), also 0 differing pixels in every case, confirming the windowing-bounds arithmetic has no off-by-one at the last (partial) row/column. This is a materially more urgent fix than D165 originally framed it: 1.6号's own upsampling can push some items to 32768x32768 (D166), which would have made this exact memory ceiling considerably worse, right as it started mattering most. Not fully closed: an Opus follow-up flagged that `local_provenance_to_global()` (this function's own caller, one level up) now becomes the new peak-memory site (~7 GiB on the same worst-case item, from holding `provenance`/`valid`/`out`/`provenance[valid]` all at once) -- a real, contained-scope finding, tracked for a future pass but not blocking 1.6号 (7 GiB is well inside the AGGREGATION_WORKERS=3 ceiling this was originally about; 10.7 GiB was not).

**#8** (`downsampling_run.py`, `main()`): `tmp_folder = filepath.replace('-downsampling.csv', '-tmp')` wasn't scoped by datatype -- an elevation pass and a lineage pass over the same generation would write identically-named intermediate `.webp` files into the same directory if ever run concurrently. Changed to `f'-{DOWNSAMPLING_DATATYPE}-tmp'`. Confirmed via grep that nothing else in the codebase parses this specific suffix (the only consumer, `validate_pixels.py`'s `*/*-tmp` glob, still matches).

**#10** (`aggregation_covering.py`, `write_aggregation_items()`): this function can be re-run against an EXISTING generation_id (`main()`'s own `AGGREGATION_ID` override, meant for re-planning after new source data lands mid-generation). If a position's source composition changes between two such passes, its `child_z` (baked into the covering CSV's filename) changes too, and the OLD covering CSV from the earlier pass used to be left on disk forever -- two aggregation items claiming one (z,x,y) position, which `get_leaf_child_z_map()`'s D166 duplicate-position guard now turns into a loud crash rather than silent misbehavior, but a mid-generation crash is still bad. First fix attempt: glob `f'{folder}/{z}-{x}-{y}-*-aggregation.csv*'` and remove anything not equal to the freshly-computed `out_filepath`.

**CRITICAL regression in the first fix attempt, caught by Opus code review before it was ever run for real**: the glob's trailing `*` after `-aggregation.csv` also matches `{out_filepath}.done` and `{out_filepath}.todo` -- the CURRENT item's own sidecars, not just a stale predecessor's. The `!= out_filepath` guard alone did not exempt them. Consequence: **any** re-run of `aggregation_covering.py` against an existing generation -- including the single most common real case, an unchanged-composition re-run (e.g. simply retrying after the covering script itself crashed) -- would have silently deleted every already-built item's `.done` manifest generation-wide, forcing `aggregation_run.py` to treat a fully-built national archive as never-done and rebuild everything from scratch, while also destroying the D163/D164 fingerprint + `leaf_child_z` data a LATER generation's cross-generation reuse depends on. This is the exact "resume state silently invalidated" bug class this whole review exists to catch, and it would not have been caught by the test written alongside the original fix -- that test never gave the CURRENT item its own `.done`/`.todo` stubs before the no-op-rerun assertion, so it couldn't have failed even with the bug present. Fixed: `if stale_filepath != out_filepath and not stale_filepath.startswith(f'{out_filepath}.'):`. The test was rewritten to actually exercise this (give the current item real `.done`/`.todo` stubs, then assert they survive an unchanged re-run) and now catches the original bug if reintroduced.

Also fixed a secondary, lower-severity gap the same review surfaced: a position that had a covering CSV in an earlier pass but drops to **zero** source coverage in a later one (the `if len(line_tuples) == 0: continue` branch) used to leave its stale covering (+ `.todo`/`.done`) behind forever -- no duplicate-position hazard (its `child_z` never changes once it hits zero), but it leaves `remove_dangling_pmtiles.py` expecting an output that will never be rebuilt. Now cleaned up the same way.

Verified with a synthetic (no real reprojection needed -- this is pure file-naming/cleanup logic) 4-pass test against an isolated fake generation_id: (1) child_z=11 written; (2) composition changes, child_z=13 written, old `-11-` csv+todo+done all removed; (3) same composition re-run -- csv AND its own `.done`/`.todo` all still present (the regression this specifically re-tests); (4) composition drops to zero coverage -- csv+todo+done all removed.

### The methodological point, again

This is the third time this session an Opus review (design or code) caught something that would have been a real production incident if it had shipped unreviewed -- after the `resolve_layer()` position-only-match catastrophe (D166) and the reuse-direction reversal (also D166). All three were changes that looked locally correct and passed their own author-written test on first read. See `HANDOVER.md` §0 for why this is now standing practice, not a one-off precaution.

### An unrelated lesson from this session's own verification process

The #5 verification script itself hung for **over 12 hours** (started 2026-09-13 18:28, killed 2026-09-14 06:18) before being diagnosed: it called `downsampling_run.main()` at module level without an `if __name__ == '__main__':` guard. `downsampling_run.main()` creates a `multiprocessing.Pool`, and macOS's default `spawn` start method re-imports the invoking script as `__main__` in every worker process -- without the guard, each worker re-ran the whole test script from its own top level, including the `downsampling_run.main()` call itself, spawning its own Pool, spawning more workers, recursively, forever. This is a bug in the ad hoc verification script, not in any file this project ships -- `downsampling_run.py`'s own `if __name__ == '__main__':` block at the bottom was never at risk -- but it's a real trap worth remembering for any future one-off script that calls a function known to spawn a `Pool` (`aggregation_run.main()`, `downsampling_run.main()`, `bundle.py`, `merge_japan_bundles.py` are the ones in this codebase that do). Always wrap such a script's executable body in `if __name__ == '__main__':`, even for a "just call this once" throwaway.

## D168: 1.6号's generation_id minted and wired; a small real dress-rehearsal (3 hand-picked items) completed successfully, including chasing down what looked like a real bug and turning out to be correct behavior

**Status**: `01M2EAPPYXT8RWNC6TXBRT36JE` minted 2026-09-14, recorded in `PLAN.md` §0 and `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` (target zoom 16) in the same work session, per D166 finding #3's own discipline. 3 real items processed for real against this generation_id (not a throwaway fake one): all behaved correctly.

**Context**: with D167 closing D165's last deferred findings, `PLAN.md`'s own "what's next" list named minting 1.6号's ID as the only remaining precondition for a dress rehearsal. Minted it and, rather than stopping there, ran a small, deliberately bounded real rehearsal: `aggregation_covering.py`'s full national covering was NOT run (that would write ~6,373 covering CSVs and, given D163/D164's reuse machinery, copy real output for every sea-only position -- a large, hours-scale operation not appropriate to start unsupervised). Instead, 3 real covering CSVs were hand-copied from 1.5号's own real `aggregation-store/` into the new generation's real directory (mirroring this session's own established isolated-fake-generation test pattern, except this generation_id is the REAL one, not a throwaway):

- `10-860-440-12-aggregation.csv` (sea-only, `jpnationalsea` single file) -- expected to REUSE from 1.5号.
- `10-910-423-13-aggregation.csv` (land, single `jpnational10` file) -- expected to be REJECTED for reuse and upsampled natively z13 -> z16.
- `11-1727-870-13-aggregation.csv` (mixed `jpnational10` + `jpnationalsea`, a coastal item) -- `is_land_item_covering()` correctly classifies "any non-sea source present" as land, so also expected to reject reuse and upsample z13 -> z16.

Ran `aggregation_covering.write_aggregation_todos('01M2EAPPYXT8RWNC6TXBRT36JE')` for real: **1/3 reused from 1.5号, 2/3 queued** -- exactly as predicted. The reused item's `.done` manifest correctly shows `"leaf_child_z": 12` (native, unchanged) and `"reused_from_generation_id": "01M1MKD73P0KDT719H21NJV9VR"`; its output is a genuine file copy, not a reference. Then ran `aggregation_run.run()` directly (not `main()`, to avoid pulling in a `Pool` and every `.todo` in the directory) for the two queued items: both completed with `"leaf_child_z": 16` recorded, both output files land at the correct upsampled path, and `aggregation_tile.py`'s own hard assert (`child_z == utils.leaf_child_z(...)`) passed for real, at real scale -- including the 32768x32768px case (`10-910-423-13`, a z10 macrotile upsampled to z16) that D166's own writeup flagged as "reaches this size, needs conscious verification before launch" but had never actually been run before.

**A real-looking bug that turned out not to be one**: the 32768x32768 item's ENTIRE output was 100% nodata -- no valid pixels anywhere, in any of its 4,096 z16 tiles. Chased this for a while (reproducing the exact `gdalwarp` command by hand, checking `gdallocationinfo` at several coordinates, comparing against a native-z13 rebuild of the same item, which ALSO came back 100% nodata) before finding the actual explanation: this source file's real valid-data footprint (via `gdalinfo -stats` plus a direct scan for non-nodata pixels: only 24 of 843,750 pixels, `valid frac ≈ 0.00003`) sits entirely OUTSIDE this macrotile's bounds -- about 7.5km east of the macrotile's own edge -- even though the source file's overall bounding RECTANGLE happens to overlap the macrotile at its western edge. `aggregation_covering.py`'s own grouping logic correctly assigns files to macrotiles by bounding-box intersection (necessarily conservative, since checking per-file real-data footprints at covering time would be far more expensive nationally), so a sparse file with a mostly-empty bounding box legitimately gets assigned to macrotiles it has no actual data in. 100% nodata for this exact position is the CORRECT answer, not a bug.

**Incidental, useful confirmation of D165's own fix**: while chasing the above, checked what 1.5号's own ALREADY-PUBLISHED archive shows for this exact same position -- and it shows the OLD bug exactly as D165 described it: all 64 native-z13 tiles read as fully-opaque (no alpha channel at all) RGB, flat elevation 0.0m, for a position that (per the analysis above) has zero real source coverage. This is a live, concrete instance of D165 finding #1 (the pre-fix `aggregation_merge.py` zero-filling every nodata pixel unconditionally, including in the single-group branch, which D165 removed the fill from entirely) -- not previously singled out by name, just one more of the "5.59% of sampled tiles" D165's own Opus review measured nationally. The REBUILT version (this session, D165-fixed code, real 1.6号 generation) correctly shows the same position as fully transparent (nodata), not fake 0m. Confirms the fix behaves correctly on a genuinely tricky real case (a source file whose bounding box, but not its real data, overlaps a position) months after the fix was written, on data the fix's own original verification never touched.

The third (coastal, mixed-source) item's real output was also checked in full: 288 of 1,024 possible z16 positions have valid data, all reading exactly 0.0m, in one contiguous rectangular band -- consistent with `jpnationalsea` (Copernicus GLO-30) reporting sea-level (0m) for open ocean along this item's coastal boundary, not a defect.

**Disk/resource footprint**: negligible -- 24KB (`aggregation-store`) + 12KB (`pmtiles-store`) for all 3 items combined; `/Volumes/Migrate-2025-04` headroom unaffected (248GiB free, checked before and after).

**Decision**: leave these 3 real items in place in `01M2EAPPYXT8RWNC6TXBRT36JE`'s own real directories, rather than deleting them -- they are correct, real production output, not test artifacts. When the generation's full national covering eventually runs, these 3 positions will already have current `.done` manifests and correctly skip (per D167's own #3 fix verifying freshness + output existence, not just presence). `utils.get_leaf_child_z_map('01M2EAPPYXT8RWNC6TXBRT36JE')` returns `{(10, 860, 440): 12, (10, 910, 423): 16, (11, 1727, 870): 16}` -- exactly the expected policy outcomes for all three.

**What's next**: the full national dress rehearsal (running `aggregation_covering.py` for real against this generation_id, which will reuse ~4,200+ sea-only positions and queue ~2,100+ land positions for full reprocessing) is a multi-hour, disk-and-compute-consuming operation appropriate for a supervised session, not something to start unattended. Recommend running it as its own explicitly-scoped step, watching disk headroom (D157's own lesson) and worker health throughout, before the "wet dress rehearsal" / real 1.6号 launch.

## D169: the full national dress rehearsal -- run for real, end to end, aggregation + downsampling, both datatypes, zero errors

**Status**: Complete for `aggregation_run.py` (both layers' first stage) and `downsampling_run.py` (both datatypes). NOT yet run: `lineage_extend_low_zoom.py`, `bundle.py`, `merge_japan_bundles.py` -- deliberately paused before those, since they start producing the actual publishable archive artifacts, a decision Hidenori asked to make explicitly rather than have continued automatically.

**Context**: Hidenori approved running the full national dress rehearsal (2026-09-14, "全国規模ドレスリハーサルの実施を承認する"), after D168's small 3-item exercise. Run start to finish over 2026-09-14 07:07 through 2026-09-15 00:10 (~17 hours), entirely against the real `01M2EAPPYXT8RWNC6TXBRT36JE` generation_id -- not a fake/isolated test directory. Ran autonomously, with periodic health checks (disk headroom, free memory, error-pattern grep) roughly every 20 minutes throughout, per the session's own established methodology of never trusting a `.done` count alone (see `CLAUDE.md`'s own standing warning) -- here extended to trusting a full raw log scan for `Traceback`/`Error`/`Exception`/`CRITICAL`/`Killed`/`MemoryError` at every stage, not just counting output files.

### What ran, in order

1. **`aggregation_covering.py`'s full national covering** (`AGGREGATION_ID=01M2EAPPYXT8RWNC6TXBRT36JE`): scanned all of `source-store/*/bounds.csv` (jpnational1 alone: 291,779 files) and regenerated all 6,373 covering CSVs. Reuse decision: **4,245/6,373 reused from 1.5号** (`01M1MKD73P0KDT719H21NJV9VR`), 2,128 queued for full reprocessing -- much better than an earlier back-of-envelope estimate (4,133) that conflated "land item, therefore ineligible for reuse" with "land item whose upsampled target actually differs from its already-native-enough leaf_child_z" (many land items were already at z16+ natively, so upsampling changes nothing for them and they reused cleanly).
2. **Caught and fixed before the expensive stage**: the covering run above was first done WITHOUT `EMIT_LINEAGE=1`, so `REQUIRED_DATATYPES` was `['elevation']` only -- every reuse decision and freshly-written `.done` manifest only certified elevation. Since 1.5号 was built with both elevation and lineage, continuing this way would have meant a later lineage pass forcing a full rebuild of every reused item (the reused items' `.done` wouldn't cover lineage). Re-ran `write_aggregation_todos('01M2EAPPYXT8RWNC6TXBRT36JE')` alone (not the full covering -- `write_aggregation_items()` doesn't depend on datatypes, no need to rescan source-store) with `EMIT_LINEAGE=1` set: same 4,245/2,128 split, confirming 1.5号's own lineage archive is complete for every reused position too.
3. **`aggregation_run.py`** (`AGGREGATION_WORKERS=3 EMIT_LINEAGE=1`): all 2,128 queued items processed. **6,373/6,373 total items `.done`, 0 errors in the full log.** Verified with an independent sample: 8 randomly-chosen upsampled (z16) land positions, each decoded directly from the real pmtiles output -- all showed real, varied elevation values (0m at coastal/low positions up to 933m), not degenerate/corrupt data.
4. **`downsampling_covering.py`**: 8,415 downsampling items planned (vs 1.5号's 8,223 -- the ~192-item difference is expected: upsampled positions now have pyramid levels down from z16 that didn't exist when capped at native zoom, exactly what D166's own design predicted). 0 errors.
5. **`downsampling_run.py` (`DOWNSAMPLING_DATATYPE=elevation`)**: all 8,415 items, 0 errors. 67GB written.
6. **`downsampling_run.py` (`DOWNSAMPLING_DATATYPE=lineage`)**: all 8,415 items, 0 errors. 138MB written.

### Results

- **Zero errors across all four compute stages**, verified by grepping every stage's full raw log for `Traceback`/`Error`/`Exception` (not sampling, not trusting exit codes alone).
- **Disk headroom unchanged throughout, on `/Volumes/Migrate-2025-04`** (248GiB free at the very start, 248GiB free at the very end) -- **CORRECTED 2026-09-16 (D171): the original explanation given here was wrong.** This was NOT APFS clonefile sharing on `/Volumes/Migrate-2025-04` -- that volume is actually **Journaled HFS+**, not APFS, and has no clonefile capability at all. The real explanation: `pipelines/pmtiles-store` and `pipelines/tmp-store` are **symlinks** to `/Volumes/pmtiles-store`, a wholly separate physical disk (`disk5s1`, genuinely APFS) -- so none of `aggregation_run.py`'s or `downsampling_run.py`'s output (184GB+117MB aggregation, 67GB+138MB downsampling) ever touched `/Volumes/Migrate-2025-04` at all, by construction, regardless of whether the D163/D164 reuse mechanism's copies were cheap or not. `/Volumes/Migrate-2025-04` itself only holds `aggregation-store/` (tiny covering CSVs) and `bundle-store/` (a real, non-symlinked directory) for this project -- and `bundle-store/` is exactly where D171's own real ENOSPC near-miss happened, one stage later. The `shutil.copy2()`-is-nearly-free claim likely still holds, genuinely, for `/Volumes/pmtiles-store` itself (confirmed APFS) -- but this session never directly measured THAT volume's own headroom during the reuse-copy phase, so treat it as plausible, not verified. See D171 for the full correction and its consequence.
- **Memory**: real pressure observed throughout (swap staying in the 1.3-1.5GB/2GB range, free pages fluctuating as low as ~3,500 pages / 56MB at times) but never fatal -- no OOM kills, no crashes, no degraded output. Coordinated with a concurrent peer session (`tokachi20260911`, a Claude Code agent on the same machine running OpenDroneMap/video-analysis workloads) about timing its own memory-heavy jobs around this run's two genuinely CPU/memory-intensive phases (`aggregation_run.py`, `downsampling_run.py`); no actual conflict materialized. See this session's own transcript around 2026-09-14 07:00-08:00 JST for the coordination detail -- not reproduced here since it's operational, not a design decision.

### What this validates

This is the first time 1.6号's upsampling feature (D166), the D163/D164 cross-generation reuse mechanism, and D167's five fixes have all run together at true national scale, against the real production directories, rather than an isolated test generation or a 3-item sample. Specifically confirms:
- `utils.leaf_child_z()`'s policy table correctly resolves all 6,373 positions with zero duplicate-position exceptions raised (the D166 code-review-added `ValueError` guard in `get_leaf_child_z_map()` never fired).
- Cross-generation reuse correctly accepts sea-only positions and correctly rejects land positions needing upsampling, at full scale (4,245 accepted, 2,128 correctly rejected and rebuilt) -- not just the 3-item sample D168 checked.
- `aggregation_tile.py`/`lineage_tile.py`'s hard `assert child_z == utils.leaf_child_z(...)` never fired across all 2,128 freshly-built items, including the 32768x32768px items D166 flagged as needing real verification.
- `downsampling_covering.py`'s `get_extents_from_coverings()` (D166's rewrite) correctly discovered the upsampled z16 leaves' own pyramid, producing a sensible, larger-than-1.5号 item count.
- D167's #3/#5 resume-freshness fixes, #8's datatype-scoped tmp folders, and #10's stale-covering cleanup all operated for real at national scale without incident (no stray `.todo`s left over from the EMIT_LINEAGE re-run, no cross-datatype tmp collisions, no duplicate-position crashes).

### What's explicitly NOT done yet

`lineage_extend_low_zoom.py` (lineage's own standalone low-zoom extension, D146) and `bundle.py`/`merge_japan_bundles.py` (the steps that actually assemble the final, publishable `.pmtiles` archives) have not been run. These get progressively closer to an actual publish-ready artifact, which is a decision point Hidenori asked to make explicitly rather than have continued through automatically -- see `HANDOVER.md`'s own "what's next" for the exact question posed.

## D170: D163/D164's reuse fingerprint doesn't cover the PRODUCER (GDAL/PROJ version) -- a real, currently-latent gap flagged by a peer session, not fixed this session

**Status**: Tracked, not fixed. Latent today (1.5号 and 1.6号 were built on the same machine, same GDAL/PROJ install, within days of each other), but a real gap for any future generation pair separated by a toolchain upgrade -- including 2号, whenever it eventually launches, if `slate`'s GDAL/PROJ get updated in the meantime.

**Context**: raised by `tokachi20260911` (a peer Claude Code session on the same machine, running an unrelated OpenDroneMap/photogrammetry project) during coordination over shared machine resources for this session's dress rehearsal (2026-09-15). Their own work that day independently surfaced a directly analogous lesson: rebuilding their published orthophoto with an IDENTICAL `options.json` (same ODM version, settings, boundary, hardlinked source images) produced accuracy figures 3.5-4.6x worse than the published archive's own measured accuracy (2.09m published vs. 7.27m/9.53m on two fresh rebuilds) -- proof that "same procedure" does not entail "same output," and that verifying inputs are unchanged (a file hash, in ODM's case) says nothing about whether the PRODUCER (ODM's own non-deterministic thread-scheduling-dependent mesh generation, in their case) behaved identically.

**The finding, applied to this project**: `utils.aggregation_fingerprint_entries()` (D163/D164) hashes the covering CSV's own content plus every referenced source file's MD5 -- i.e., the INPUTS. It says nothing about the PRODUCER: the exact `gdalwarp`/`gdal_translate` binary and its linked `GDAL`/`PROJ` versions, which govern resampling behavior (cubicspline edge handling), default compression/block layout, and coordinate transforms (a PROJ grid-shift database update can silently change transformed coordinates for the same input). If a future generation's own environment has a newer GDAL/PROJ than the generation it's reusing from, the fingerprint still matches (inputs unchanged), `try_reuse_from_previous_generation()` still copies the old generation's output forward, and the copied tile can end up subtly inconsistent with its freshly-rebuilt neighbors -- a silent failure mode, not a loud one. This project's own pipeline is deterministic in a way ODM's photogrammetry is not (no thread-race-dependent mesh generation; `gdalwarp -r cubicspline` on identical inputs with identical GDAL/PROJ should be byte-reproducible), so this is a narrower risk than tokachi's own ODM finding -- but the toolchain-version blind spot is real and structurally identical.

**Two proposed mitigations, both un-implemented, tracked for a future design pass** -- and, per tokachi's own follow-up, these two have very different right timing, not the same one:
1. **Mix producer identity into the fingerprint** (e.g. `gdalinfo --version`'s output string, which embeds the linked PROJ version too, as one more `content_input_entry()`-style entry in `aggregation_fingerprint_entries()`). Cheap to implement, but **wrong to apply now**: changing the fingerprint's definition immediately invalidates every current reuse decision, since 1.6号's own environment is identical to 1.5号's (same machine, same install, days apart) -- adding this today would force a full rebuild of everything currently reused, paying the full cost of an environment change that never actually happened. The right time is **immediately before the first generation built on an upgraded GDAL/PROJ toolchain** -- at that point the full recompute this triggers is the recompute that SHOULD happen anyway, not wasted work.
2. **Periodically audit reuse for real, independent of the fingerprint**: for a small random sample of positions reused in a generation, rebuild them WITHOUT reusing and diff against the copied output. This one is safe and cheap to add starting from the CURRENT generation -- it doesn't touch the fingerprint or invalidate any existing reuse, just costs a handful of extra rebuilds to verify. Matches, in spirit, the exact class of bug tokachi separately found in their own ODM logging that same day (a `docker run ...; echo "...rc=$?"` construct where `$?` was actually `date`'s exit status, not the docker run's -- silently reporting `rc=0` for a run that had in fact crashed with SIGSEGV; their own summary: "a detector that had never once failed couldn't distinguish 'succeeded' from 'never actually checked'"). The same shape applies here: `try_reuse_from_previous_generation()` returning `True` proves the fingerprint matched, not that the reused output is actually still correct -- an occasional real rebuild-and-diff is the only way to find out, rather than trusting the mechanism's own self-report. Being cheaper and non-disruptive, **#2 is the one worth implementing first**, ahead of #1.

**Important asymmetry in this audit's own design, corrected by tokachi's own follow-up** (worth recording precisely, since the natural first instinct -- treat this like any other statistical spot-check -- is wrong here): a MATCH and a MISMATCH do not carry equal evidential weight, and not for the usual small-sample-size reason. This project's own pipeline is deterministic (unlike ODM's thread-race-dependent mesh generation, which tokachi's own `n=1` result genuinely couldn't support a conclusion from either way). For a deterministic pipeline, a random sample matching only ever proves "this one tile happened to be fine" -- weak evidence, exactly as intuition suggests. But a MISMATCH is NOT a chance event that could equally have gone the other way: under a deterministic pipeline, two independent builds of the same input producing different output is only possible if something is actually broken (a toolchain change, a bug, non-determinism that shouldn't exist). So **a single mismatched tile is decisive and reportable on its own -- no sample-size threshold needed before treating it as a real finding** -- while accumulating many matched tiles never proves the mechanism is healthy, only that it hasn't yet been caught failing. The audit's actual job is early detection of breakage, not a health certification; design and read it that way (stop and investigate on the first mismatch; never write "N/N tiles matched, therefore reuse is verified correct").

**Not fixed this session**: neither mitigation was implemented -- doing so mid-dress-rehearsal, without validating the change against real data first, would repeat exactly the kind of rushed-fix risk this project's own standing practice (D165 through D169) exists to avoid. Revisit #2 as a near-term follow-up (cheap, safe to add anytime); revisit #1 specifically when a GDAL/PROJ toolchain upgrade is next planned for `slate`, not before.

### A methodological addendum, added within the hour of the finding above

While recording this entry, this session independently made the exact same class of error tokachi's own message described (see their SIGSEGV/`rc=$?` story above): wrote a `grep`-based check for stray tool-call artifacts accidentally committed into this file, ran it, got "clean," and committed -- twice, both times wrong, because the shell script never gated its own "clean" message on the grep's actual exit status. Both errors shipped (one was even pushed to `origin/main` before being caught by a THIRD, more careful pass). tokachi's own follow-up generalized this correctly: **a verification check that has never been observed to fail cannot be trusted to distinguish "no problem" from "the check itself is broken"** -- and both failure shapes here (this session's ungated grep, tokachi's `$(date)`-clobbered `$?`) fail SILENTLY, in the direction that reassures the person who just wrote the check, which is exactly backwards from where a bug should surface. The generalized practice, worth carrying into any future verification script in this project: **before trusting a check, deliberately make it fail once and confirm it actually reports failure** -- a planted typo for a grep-based scan, a deliberately-missing file for an existence check, a hand-corrupted value for a hash comparison. Costs seconds; the alternative is discovering the check was decorative only after it already let something bad through.

## D171: `bundle.py` triggered a real ENOSPC near-miss -- traced to a wrong assumption about which physical disk `pmtiles-store/` actually lives on; resolved by moving 513GB of superseded 1.5号 archive files to the correct volume

**Status**: Resolved. 513GB moved off `/Volumes/Migrate-2025-04` to `/Volumes/pmtiles-store` (a separate, larger disk); `/Volumes/Migrate-2025-04` now has 590GiB free (more headroom than at any point in D169). `bundle.py` (elevation) restarted after the move. D169's own "disk headroom unchanged" explanation corrected (see that entry's own update, same date) -- it attributed APFS clonefile sharing to the wrong volume.

**What happened**: with Hidenori's go-ahead to proceed to the final-assembly stage (`lineage_extend_low_zoom.py` -> `bundle.py` -> `merge_japan_bundles.py`), `lineage_extend_low_zoom.py` ran cleanly (single-threaded, low resource, D146's own low-zoom pyramid extension -- no issue). `bundle.py` (elevation, `BUNDLE_WORKERS=4` default) was then started and, over about 35 minutes, drove `/Volumes/Migrate-2025-04`'s free space from 248GiB down to 112GiB -- a genuinely alarming rate that, extrapolated, would have hit ENOSPC well before the elevation bundle alone finished (the full elevation dataset bundle.py needs to repack is ~270GB). The process was killed (`SIGTERM`) as a precaution before that happened.

**Root cause, found by direct investigation (not guesswork)**: `bundle-store/` already held **478GB of files predating this session's own work** (`mapterhorn-japan-bridge.pmtiles` 258GB, `mapterhorn-japan-bridge.z8plus.pmtiles` 254.9GB [decimal GB arithmetic — the two round differently in GiB], `mapterhorn-japan-bridge-lineage.pmtiles` 204MB) -- all last modified 2026-09-10, the timestamps of 1.5号's own real prior publish cycle (`merge_japan_bundles.py`'s own final-product output path, per `CLAUDE.md`'s own documented naming). `bundle-store/` is a genuine, non-symlinked directory directly on `/Volumes/Migrate-2025-04` (unlike `pmtiles-store/`/`tmp-store/`, which are symlinks to the separate `/Volumes/pmtiles-store` disk -- see D169's corrected entry). So `bundle.py`'s own fresh per-region output (verified, via direct source-vs-output byte accounting for individual regions, to track its true ~270GB source total reasonably closely, no runaway duplication) was landing in the SAME already-478GB-full directory the whole time, on a volume whose starting headroom (248GiB) was never enough to hold both the stale leftovers and a fresh full rebuild simultaneously.

**Also found and fixed in passing**: `bundle.py`'s own local `create_archive(filepaths, name)` (distinct from `utils.create_archive()`, which already has the tmp+`os.replace()` atomicity pattern) writes directly to `out_filepath` in `'wb'` mode -- non-atomic. An ENOSPC crash mid-region-write would have left a truncated, unparseable `.pmtiles` file sitting at its real, final path. Not fixed this session (interrupting the process cleanly via SIGTERM, then noting the issue, was enough to avoid it this time) -- flagged here so a future pass on `bundle.py` applies the same fix `aggregation_merge.py`/`utils.create_archive()` already have.

**Decision (Hidenori, 2026-09-16, via `AskUserQuestion`)**: move the 478GB (513GB of actual bytes once matched exactly) to `/Volumes/pmtiles-store` (a separate disk, confirmed genuinely APFS, 943GB free before the move) rather than deleting -- reversible, and these files are plausibly still the live source of what `stars` currently serves for 1.5号, so deletion was explicitly ruled out as too risky to decide unilaterally. Moved to `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916/` via a real cross-filesystem `mv` (HFS+ -> APFS, no shared-extent shortcut possible between different filesystem types -- this took about 50 minutes for 513GB, consistent with genuine byte copying, not a fast rename). Verified: all 3 files present at the new location with matching sizes, gone from the old location, `/Volumes/Migrate-2025-04` headroom recovered to 590GiB (better than D169's own 248GiB baseline, since `bundle.py`'s own earlier partial/interrupted per-region output -- disposable, would be overwritten by a correct re-run regardless -- was still counted as consumed space at the time of the move, and remains there pending `bundle.py`'s own fresh, complete run).

**Lesson for future sessions**: don't assume a project's own documented data-layout table (`CLAUDE.md`'s pipeline description, `pmtiles-store/{layer}/{datatype}/{generation_id}/...`) describes one physical disk just because it's one directory tree from the pipeline's own point of view -- check `ls -la` for symlinks and `diskutil info`/`df -h` on the REAL mount points before reasoning about available headroom, especially before starting any stage (like `bundle.py`, unlike `aggregation_run.py`/`downsampling_run.py`) that writes into a directory NOT proven to be symlinked elsewhere.

**Addendum, same session, `merge_japan_bundles.py`'s own clustering step**: after `bundle.py` completed cleanly for both datatypes, `merge_japan_bundles.py` (elevation) ran its merge loop correctly (deletes each `bundle-store/` region file as it's consumed, per `os.remove(path)` -- net disk usage on `/Volumes/Migrate-2025-04` stayed bounded throughout, recovering to 475GiB by completion) and then invoked `./pmtiles cluster` on the 269.6GB output, per D144's own unconditional-clustering design. That step sets its own `TMPDIR` to `pmtiles-store/tmp-store/go-cli-scratch` (i.e., on `/Volumes/pmtiles-store`, via the symlink) and **left a 251GB temp file there uncleaned after successfully finishing** (`go-cli-scratch/pmtiles<random>`, dated to exactly when clustering completed, sitting alongside the already-finalized real output). Verified safe to delete (single file, inside a directory literally named `scratch`, the real output already existed intact at its own separate path) and removed by hand -- `/Volumes/pmtiles-store` recovered from 214GiB to 465GiB free. Not a bug in this project's own code (the `pmtiles` CLI is an external Go binary, `protomaps/go-pmtiles`); worth remembering as a recurring manual cleanup step after every future `merge_japan_bundles.py` run that triggers clustering (both datatypes), since `/Volumes/pmtiles-store` is a shared, multi-tenant disk (other Claude Code sessions' own project data lives there too) and this leftover is large enough to matter to them, not just to this project.

## D172: 1.6号's full final assembly completed (`bundle.py` -> `merge_japan_bundles.py` -> `pmtiles cluster` -> z0-7 splice -> integrity verification) -- and a 116-tile lineage orphan gap confirmed pre-existing, not a regression

**Status**: Complete. Per Hidenori's approval ("この工程も進めてよい", 2026-09-16), ran the remaining final-assembly steps to completion for both datatypes, producing artifacts equivalent in scope to 1.5号's own published archive.

**What ran**: `bundle.py` (elevation, then lineage) -> `merge_japan_bundles.py` (elevation, then lineage; each includes its own unconditional `pmtiles cluster` per D144) -> `pmtiles verify` -> `./pmtiles merge bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles /Volumes/Migrate-2025-04/global-overview-backup.pmtiles bundle-store/mapterhorn-japan-bridge.pmtiles` (the z0-7 global-overview splice, elevation only -- lineage's own `bundle-store/mapterhorn-japan-bridge-lineage.pmtiles` is already the final product per D109's own established convention, no splice needed) -> `pmtiles verify` -> `check_pmtiles_integrity.py` (the deeper, directory-only orphan-tile check this project's own history shows `pmtiles verify` alone can miss -- see D100).

**Results**:
- **elevation**: final `mapterhorn-japan-bridge.pmtiles`, 272.9GB, min_zoom=0 max_zoom=16, 3,461,089 tiles, global bounds (confirming the z0-7 splice took). `check_pmtiles_integrity.py`: **CLEAN -- every tile at every zoom > min_zoom has a parent one zoom coarser.** Zero orphans.
- **lineage**: final `mapterhorn-japan-bridge-lineage.pmtiles`, 217MB, min_zoom=4 max_zoom=16, 3,447,709 tiles. `check_pmtiles_integrity.py` found **116 orphaned tiles, all at z8** (a z8 tile with no corresponding z7 parent) -- e.g. `(213, 113)`, `(237, 88)`, `(226, 88)`.
- **Disk headroom**: all four heavy stages (`bundle.py` x2, `merge_japan_bundles.py` x2 including clustering, the z0-7 splice) completed within `/Volumes/Migrate-2025-04`'s own headroom after D171's fix, ending at 221GiB free -- no further ENOSPC risk materialized.

**The 116-tile lineage gap: investigated immediately, confirmed pre-existing, not a regression**: ran the identical `check_pmtiles_integrity.py` against 1.5号's OWN already-published lineage archive (moved to `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916/` by D171) -- **found the exact same 116 orphaned tiles, at the exact same z8 positions**, already present. This rules out anything this session's own work (D163-D171) introduced or worsened; it's a real, currently-live characteristic of the CURRENTLY-PUBLISHED 1.5号 archive on `stars`, never previously caught by this project's own integrity checks (this appears to be the first time `check_pmtiles_integrity.py` was run against the lineage archive specifically, rather than only the elevation one, based on this file's own prior D100/D122 entries only mentioning elevation runs).

**Not investigated further or fixed this session** (deliberately, matching this project's own "don't rush a fix mid-rehearsal" discipline): the likely mechanism is `lineage_extend_low_zoom.py`'s own D146 low-zoom extension (`building z7 from z8...`, its own log showing `440 source tiles -> 117 parent tile(s) at z7, skipped 29 all-nodata parent tile(s)` -- 117+29=146 accounted for against 440 input z8 tiles leaves a real gap unaccounted for, plausibly related to these 116 orphans, though the exact arithmetic wasn't traced end-to-end). Tracked as a real, pre-existing, low-severity finding (116 tiles out of 3.4M, all at a single coarse zoom level, in the lineage/provenance sibling archive rather than the primary elevation product) for a future session to root-cause and fix -- likely alongside D165's other still-open items (#6's `lineage_provenance.py` rewrite is in the same file family).

**Post-completion cleanup (same day, Hidenori's explicit request)**: once the dress rehearsal's final archives were confirmed complete and verified, `bundle-store/`'s remaining old files were cleaned up in two rounds, both explicitly authorized rather than done unilaterally: (1) `mapterhorn-japan-bridge.z8plus.pmtiles` (269.6GB) -- the intermediate product this entry's own `pmtiles merge` step already consumed to produce the final `mapterhorn-japan-bridge.pmtiles`, genuinely disposable once the splice succeeded and was verified; (2) `mapterhorn-japan-bridge.pmtiles.d153-backup` (258GB) and `mapterhorn-japan-bridge-lineage.pmtiles.d153-backup` (204.7MB) -- older, explicitly-named backup files from 2026-09-08 (predating D171's already-moved 1.5号 archive, likely a pre-D153-regen safety backup), found in passing while cleaning up (1) and flagged rather than deleted on sight since "backup" in the filename signals deliberate retention, not an incidental build artifact -- deleted only after Hidenori confirmed. `/Volumes/Migrate-2025-04` recovered to 712GiB free; `bundle-store/` now holds only the two current, final 1.6号 archives.

### Naming/scope decision (Hidenori, 2026-09-16): "ウェットドレスリハーサル" retired as a separate stage -- what remains IS 1.6号

Asked to confirm before proceeding to publish, and in doing so, re-checked what "ウェットドレスリハーサル" (wet dress rehearsal) had actually meant across this project's own history -- **it turns out to never have been concretely defined**. The only real precedent (D157's own 2026-09-11 note, from 1.5号's own prep) used the phrase to mean a smaller-scale REAL trial, positioned BEFORE the 50-70 hour full national run -- i.e., "wet rehearsal" as *rehearsal for* the real launch, not the launch itself.

For 1.6号, that staging never actually happened as originally imagined: D169 went straight to a full-scale, real, national-scope build (not a scaled-down trial) under the "dress rehearsal" label, and D172 already carried it all the way through final assembly and integrity verification. There was no smaller real trial left to run BEFORE the real thing, because the real thing had already been built. Hidenori's own conclusion, stated directly: **retire "ウェットドレスリハーサル" as a distinct stage name.** What remains -- the visual verification (D79's own established pre-publish practice, not yet done for 1.6号 specifically) and the actual `stars` upload -- is not a rehearsal for 1.6号; **it IS 1.6号.** Framing going forward: **1.6号 is already ~80% complete** (covering through final archive assembly, D162-D172); the remaining ~20% is visual verification + publish, not a separate gated "rehearsal" phase.

This also resolves an open question `HANDOVER.md`'s own "what's next" list has been carrying since D169: whether to await a separate "wet dress rehearsal / real launch" decision. There isn't a separate decision anymore -- proceeding to visual verification now, `stars` publish next, both as 1.6号's own remaining work.

### Visual verification (D79's own established pre-publish practice, applied to 1.6号 for the first time)

Wrote a standalone hillshade-rendering script (`scratchpad/render_visual_check.py`, not committed -- one-off, matches this project's own established "verification scripts stay local" convention) reading directly from the final merged archive (`bundle-store/mapterhorn-japan-bridge.pmtiles`), decoding terrarium tiles via `pmtiles.reader.Reader` + numpy/PIL, and rendering a simple sun-angle hillshade for a human "does this look right" check -- something D162-D172's own extensive programmatic verification never substituted for.

Five locations, chosen for specific reasons: Mt. Fuji (a landmark with a precisely known real elevation, the strongest single sanity check available), Tsushima and Goto (both sites of this project's own worst historical defect, the D113-D118 z8-11 "奈落" voids), Yonaguni (a small island, tests upsampling behavior at the extreme western edge of the archive), and the specific native-z11-to-z16 upsampled item sampled earlier in D169 (`11/1829/776`, rendered at full z16 resolution, 256 tiles stitched).

**Results, all positive**:
- **Fuji**: summit elevation 3772.5m in the rendered data vs. the real, well-known 3776m -- a 3.5m difference, well within plausible survey/encoding tolerance. Visible parasitic cones (側火山) and radial drainage channels, both real, well-documented features of the volcano -- exactly what a correct render should show.
- **Tsushima/Goto**: full island terrain rendered, including the smallest outlying islets, with NO voids -- the exact defect class (D113-D118) this project spent real effort fixing in earlier generations stays fixed in 1.6号.
- **Yonaguni**: island shape and terrain correct; a large black region in the rendered PNG turned out to be the verification SCRIPT's own limitation (queried a single fixed zoom, z13, which native-z12 sea-only surroundings simply have no tile at -- not a data gap, confirmed by the script's own tile-count log showing exactly the expected sea-only exclusion), not an archive defect.
- **Upsampled mountain (native z11 -> z16, 1.6号's own new feature)**: fine ridge/valley detail, a visible river/road line crossing the terrain, 256 stitched z16 tiles with **no visible seams, no blocky upsampling artifacts, no cubicspline ringing** -- the single most important image for confidence in the upsampling feature specifically, and it looks like genuine, physically plausible fine terrain, not degraded/interpolated noise.

Sent to Hidenori directly (3 of 4 images; the largest, `visual_upsampled_mountain.png` at 31.3MiB, exceeded the remote-viewer file-size limit but was already visible inline in this session).

**Decision (Hidenori, 2026-09-16, "いいね。視覚確認GOとする。")**: visual confidence established. Proceeding to the `stars` publish itself, staged: lineage (217MB) first as a low-risk trial of the new transfer-then-delete procedure, elevation (272.9GB) after that succeeds cleanly.

## D173: 1.6号 published to `stars` -- both datatypes live, verified end to end. Launch complete.

**Status**: Done. Both `mapterhorn-japan-bridge.pmtiles` (elevation, 272.9GB) and `mapterhorn-japan-bridge-lineage.pmtiles` (lineage, 217MB) are now the live files on `stars` (`/home/stars/data/`), serving real 1.6号 data (generation `01M2EAPPYXT8RWNC6TXBRT36JE`). Per D172's own naming decision, this publish itself IS 1.6号's launch, not a rehearsal for one.

**New publish procedure, used for real for the first time and validated end to end**: now that `stars` has ~1.3TB free (D171-era headroom concerns don't apply there), transfer the new file under a `.new` suffix via direct `scp` from `slate` to `/home/stars/data/` (no need to route through the `stars` peer session), verify its MD5 against a locally-computed MD5 of the same source file, then perform an atomic same-directory `mv` twice -- old live file -> a dated backup name, `.new` -> the live filename. `martin` (the tile server) fs-watches `/home/stars/data/` and picks up the atomic rename within seconds; no restart needed (a restart is only required for registering a genuinely new source id, not for replacing an existing file's bytes). This replaces D142's old "delete-then-transfer" pattern, which existed specifically because `stars` used to be too disk-constrained to hold both the old and new copies at once.

**Lineage (first, low-risk trial of the procedure)**: transferred, MD5-verified, atomically swapped in. Old 1.5号 lineage file preserved as `mapterhorn-japan-bridge-lineage.pmtiles.1.5go-backup-20260916` (204,702,258 bytes, dated Sep 12 -- notably NOT byte-identical to the copy this session separately archived to `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916/` under D171, which is 204,702,258 vs a slightly different size/date; this implies a separate lineage-only republish happened on 9/12 that D171's own archive-the-bundle-store-files pass didn't capture. Noted, not further investigated -- doesn't affect 1.6号's own correctness, just a minor provenance gap in exactly which 1.5号 lineage bytes are sitting in that backup directory now vs which were live on `stars` at any given moment). Verified live via `https://stars.optgeo.org/mapterhorn-japan-bridge-lineage`'s TileJSON and a sample tile URL, both correct.

**Elevation (second, the real payload)**: transferred via `scp` (272,864,946,957 bytes, ~7.5 hours at the historically-consistent ~11.5MB/s rate documented in D142). Local MD5 (`db3c45675ac1105b0baadab698ba474a`, computed in parallel with the transfer) then had to be checked against a REMOTE `md5sum` run on `stars` itself -- this took far longer than expected, **roughly 20 hours**, not the few seconds the 217MB lineage file's own MD5 check took. Investigated live via `/proc/<pid>/io`'s `rchar` counter (not `ps`'s own CPU-time field, which badly understated progress on this host and would have wrongly suggested the process was stalled) -- confirmed genuine, steady, if slow (~0.6-3.6MB/s, fluctuating, likely contending with `stars`' own live tile-serving I/O) forward progress throughout, never actually stalled. Result: **MD5 matched exactly** (`db3c45675ac1105b0baadab698ba474a` both sides). Atomically swapped in (old 1.5号 elevation file preserved as `mapterhorn-japan-bridge.pmtiles.1.5go-backup-20260916`, 258,141,372,680 bytes). Verified live via `https://stars.optgeo.org/mapterhorn-japan-bridge`'s TileJSON (200 OK, correct description string) and a sample z13 tile over Mt. Fuji (200 OK, 108,558 bytes).

**Lesson for future sessions publishing large files to `stars`**: don't assume a remote integrity check scales with local experience of the same operation -- `stars` is real production hardware serving live traffic, not build hardware, and a multi-hundred-GB `md5sum` there can take an order of magnitude longer (proportionally) than the same check on `slate` or than a much smaller file's own check on the same host. When a long-running remote command's `ps`-reported CPU time looks implausibly low relative to elapsed wall time, check `/proc/<pid>/io`'s `rchar`/`read_bytes` before concluding the process is stuck -- it may simply be I/O-bound and progressing correctly while CPU-time accounting on that host is misleading.

**This completes 1.6号's launch.** Both archives are live, verified, and correspond to the generation this whole session (D162-D173) built, fixed, reviewed, and assembled. Remaining open items are all tracked, non-blocking follow-ups: D170's reuse-fingerprint producer-version gap (latent until a toolchain upgrade), D172's 116-tile lineage orphan gap (pre-existing, low-severity), `bundle.py`'s own non-atomic `create_archive()` (D171), and the not-yet-triaged minor items below D165's top-10 cutoff. 2号 remains gated on GSI's next DEM1A update (last checked 2026-09-11, still 2026-07-31), per `CLAUDE.md`'s own standing mission section.

## D174: The "壁" (wall) problem recurs in 1.6号 near tiny isolated islands (波照間島, 久場島/Senkaku) -- traced to missing tiles at the coverage edge, the same MapLibre mechanism (A) from D113-D118, apparently never fixed. Targeted for resolution before 2号

**Status**: Open, tracked, real. Root mechanism confirmed against both the local archive and the live `stars` server. Not fixed this session -- Hidenori has explicitly scoped this as a goal to close out **before 2号's launch**, with Opus/Fable subagent use pre-approved for the investigation/design/review work.

**How this surfaced**: Hidenori's own visual spot-check of 1.6号 (the same D79/D172 practice used before publish, now applied post-publish to more remote locations) noticed that Yonaguni-class islands render cleanly, but 波照間島 (Hateruma, southernmost inhabited island of Japan) and 久場島 (Kuba-jima/Kobi-sho, Senkaku Islands, ~0.91km²) show large, geometrically clean vertical walls in the live viewer's 3D terrain (`https://hfu.github.io/mapterhorn-japan-bridge/#hash=9.12/25.9253/123.6579/133.9/51` and `.../#hash=9.07/24.0509/123.8424/0/49`), appearing specifically once zoomed to about z9. Framed as: large islands have enough surrounding real-data "margin" to keep any edge defect off-screen; islands this small don't.

**Ruled out by direct inspection** (`pmtiles.Reader` against `bundle-store/mapterhorn-japan-bridge.pmtiles`, both islands, z8-z16, a wide radius including 20km out to open sea):
- No raw elevation value anomalies -- every sampled tile's decoded Terrarium min/max stayed physically plausible (roughly -11..1904m across the whole sampled region; nothing near a `-9999`/`-32768`-class sentinel).
- No tile-pyramid depth hole at the islands themselves or nearby -- both islands' own land items carry real data all the way to z16 (the D149-151/D166 land-area upsampling feature working as intended).
- `app.js`'s terrain exaggeration is 1 (`map.setTerrain({source:'mapterhorn', exaggeration:1})`) -- rules out a legitimate steep slope being visually amplified.
- `style.json`'s `mapterhorn` source (`encoding: terrarium`, `tileSize: 512`) matches this session's own independent Python decode exactly -- rules out an encoding-config mismatch.

**What actually explains it**: a systematic scan for tiles present in the archive but immediately adjacent (4-connected) to a MISSING tile, at z9-z11 near both islands, found dozens of such boundaries -- including, near Hateruma at z11, an unbroken east-west line of 10+ consecutive missing tiles running directly along one side of a matching line of present tiles (the exact shape of the horizontal "pipe" artifact in the screenshot). Verified live against `stars`, not just the local file: `GET /mapterhorn-japan-bridge/9/431/217` (a real tile touching 久場島) returns `200`, 252 bytes; its immediate northern neighbor `9/431/216` returns `204`. This is precisely **mechanism (A) from D113-D118**: Fable's own MapLibre-source-code reading at the time established that a missing/204 raster-dem tile is decoded as RGB(0,0,0) = **-32768m**, not a transparent gap -- so any present/missing tile boundary is a de facto -32768m cliff in any MapLibre-based 3D terrain view. D113-D118's own fix only patched the *specific* Tsushima/Goto instance (stale `.done` markers hiding two real, already-downloaded source files, causing `DOWNSAMPLING_STRICT=1` to skip a whole covering branch) -- the *general* mechanism (coverage-polygon edges, wherever they fall, are de facto -32768m cliffs in any MapLibre viewer) was never structurally fixed, just individually patched where Hidenori happened to spot it.

**A second thread, checked and REFUTED**: hypothesized that D165's #1 fix (this session, already live in 1.5号 and inherited by 1.6号) -- which restored correct nodata semantics in `aggregation_merge.py` (pixels no source group ever covers now correctly stay `-9999`/alpha=0 instead of the `1b6e4e1`-era unconditional zero-fill that had been silently painting them as fake 0m) -- might have *increased* the rate of genuinely-missing (204-equivalent) tiles at coverage edges, if `downsampling_run.py`'s `weight_sum>0` gating responds to an entirely-nodata input by omitting the tile rather than emitting an all-nodata one. **Tested directly**: compared tile presence/absence, tile by tile, between 1.6号's live archive and 1.5号's own already-published archive (archived copy at `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916/mapterhorn-japan-bridge.pmtiles`, D171), at z8-z11 around both islands plus a Yonaguni control, 13x13-tile grids each. **Result: identical tile-presence counts and identical missing-tile positions at every zoom, both locations, zero tiles differing between the two generations.** D165 #1 did not change this. This also means the "壁" was already present, unnoticed, in the currently-superseded 1.5号 archive -- a structural characteristic of the pipeline going back at least to 1.5号, not something 1.6号 introduced or worsened. Confirms D113-D118's own framing: this is a design-level gap (coverage-polygon edges are unconditionally -32768m cliffs in MapLibre), not a regression to hunt down in any one generation's diff.

**Scoping decision (Hidenori, 2026-09-17)**: record this now, continue the investigation with Opus/Fable subagent help pre-approved, and treat closing this out as a goal for **before 2号's launch** -- not an emergency fix to 1.6号's already-published archive, but not indefinitely deferred either. Given this project's own established discipline (validated repeatedly this session and in D113-D118 itself): investigate and verify against real data first, draft any structural fix as a design document, get an independent Opus review of the design BEFORE writing code, implement, then get the implementation code-reviewed too.

**Next steps, in order**:
1. ~~Test the D165 #1 interaction hypothesis above against real 1.5号-vs-1.6号 archive data at the same coordinates.~~ Done, same session -- refuted (see above).
2. ~~Re-read D113-D118 for prior mitigation proposals; check whether the gap traces to `downsampling_run.py`'s own tile-writing logic.~~ Done, same session -- see the concrete root cause below, which is more specific than anything D113-D118 considered.
3. Design review (Opus) before implementation; implementation review (Opus) before this is considered done.
4. Whatever design is chosen should be validated against a real, isolated small-island case (Hateruma/Kuba-jima are ready-made test cases) before being trusted at national scale for 2号.

### Concrete root cause found, same session: `jpnationalsea`'s own source-tile curation has real gaps at tiny/remote islands

Confirmed `downsampling_run.py`'s own `create_tile()` (line 328) always writes a parent tile unconditionally, regardless of `weight_sum`/alpha -- so mechanism (A)'s missing tiles are NOT downsampling silently skipping all-nodata output. The gap is one level further back: `downsampling_covering.py` (and `aggregation_covering.py` before it) never produces an item at all for these positions, because there is **no source data whatsoever** to aggregate there.

Traced to `source-catalog/jpnationalsea/Justfile`'s own documented design: `jpnationalsea` is **275 of GLO-30's global 24,674 1°×1° tiles**, filtered to a rectangular box (20-46N, 122-154E) -- chosen on the stated assumption that "GLO-30's own tile inventory already appears to exclude pure-open-ocean tiles with no land content" (24,674/64,800 possible global cells), so a precise EEZ-polygon filter would supposedly produce nearly the same result as the simpler rectangle. A coverage check at the time (2026-08-19) verified tiles exist at the box's four extreme corners, but not that every INTERIOR cell containing real land actually has a tile.

**Directly verified this session**: `source-store/jpnationalsea/bounds.csv` has no entry for `N26_00_E123_00` -- the exact 1°×1° cell immediately north of 久場島 (Kuba-jima, 25.93N/123.68E). `find source-store/jpnationalsea -iname "*N26_00_E123*"` returns nothing; the file was never downloaded (not merely un-covered by a downstream stale marker, D53/D69/D100-style -- it simply isn't in this source's own `file_list.csv` in the first place). Kuba-jima itself is real, if tiny (~0.91km²) -- meaning the Justfile's own 2026-08-19 "outlying islands aren't silently dropped" corner-check did not, in fact, catch every case; it checked the box's own geographic extremes, not every islet inside it.

**Framing this correctly**: this is very likely NOT primarily a bug in this project's own pipeline code (aggregation/downsampling logic is behaving exactly as designed given its inputs) -- it's a **source-curation gap**, closer in shape to D115's Tsushima/Goto root cause (missing coverage, not a processing bug) than to D116's boundary-erosion bug. Whether the upstream GLO-30 tile inventory itself lacks a tile for this cell (a genuine data-source gap, matching the Justfile's own stated assumption about GLO-30 excluding "no land content" cells -- plausible if GLO-30's own land mask doesn't register an island this small) or whether the tile exists upstream but was simply never selected into `jpnationalsea`'s own `file_list.csv` (a curation gap, cheaply fixable by re-downloading) is not yet determined -- this is the first thing the delegated investigation below should settle.

**Delegated to a background Opus agent** (Hidenori's pre-approval, 2026-09-17, "Opus や Fable のサブエージェントを活用することも事前承認する"): a thorough investigation covering (1) whether N26_00_E123_00 and similarly-implicated cells exist upstream at all, (2) a systematic cross-reference of every `jpnational1`/`5`/`10` (real GSI land) position nationwide against `jpnationalsea`'s own 275-tile grid, to bound the true scope, and (3) concrete structural fix proposals with tradeoffs. Full report below.

### Investigation results (Opus subagent, worktree-isolated, read-only, ~39 minutes)

**Question 1 -- genuine upstream gap, confirmed, not a curation gap.** Three independent lines of evidence: (a) `source-catalog/glo30/file_list.txt` (the full global GLO-30 inventory snapshot, 24,674 cells) has no `N26_00_E123_00` entry; (b) `jpnationalsea`'s 275 cells are *exactly* that global inventory intersected with its own declared box (20-46N, 122-153E) -- zero cells dropped by the box filter, zero cells the box should have that the inventory lacks; (c) a live HEAD check against the actual upstream AWS bucket confirms `N26_00_E123_00` is a real 404, with `N25_00_E123_00`/`N24_00_E123_00` (both in our list) returning real 200s as controls, proving the URL pattern itself is right. **There is nothing to re-download -- "fill the curation gap" is a dead end, formally closed.** A bonus finding: `tiles.mapterhorn.com` (upstream Mapterhorn's own production server) 404s at the exact same positions -- this is a shared gap in the whole Mapterhorn/GLO-30 lineage, not a japan-bridge-specific defect, and worth reporting to Oliver Wipfli given D160's own "reliable Japan supplier" framing.

**Question 2 -- scope is nationwide, not two islands.** Cross-referencing every real `jpnational1`/`5`/`10` land position against `jpnationalsea`'s 275-cell grid found exactly one real land-cell gap nationwide (孀婦岩/Sofugan, a ~99m rock pillar in the Izu-Ogasawara chain -- also absent from GLO-30 upstream, and already covered by GSI DEM10B anyway, so also nothing to fix). But the ACTUAL exposure is far broader: measured directly in the published 1.6号 archive, of land-containing tiles nationwide, **13.2% at z9 and 5.2% at z10 are directly 4-adjacent to a missing (204) tile** -- spread across Senkaku, Hateruma, southern Okinawa, Yaku-shima/Tanega-shima, Danjo Islands/Goto, the Shimane coast, offshore Chiba, Shakotan, Teuri/Yagishiri, the Kurils, Okinotorishima, Minamitorishima, and most of the Iwo-jima/Ogasawara chain. This has been present since at least 1.5号 (matches this entry's own earlier 1.5号-vs-1.6号 comparison finding real data. `downsampling_covering.py` lines 120-129 record an earlier explicit judgement that such gaps are "harmless at z8+ (nobody navigates deep ocean at that zoom)" -- correct everywhere except where a small island happens to sit right at the inventory's own ragged edge, exactly Hateruma/Kuba-jima's situation.

**Design options, with a corrected reframe**: mechanism (A) can't be eliminated outright for any finite-extent archive (there's always an outermost tile) -- the real goal is pushing the present/absent boundary out to deep, land-free ocean, the same principle the existing z0-7 global splice already relies on. Five options considered:
- **Option 1 (fill the curation gap)**: dead, per Question 1 above.
- **Option 1b (widen `jpnationalsea`'s box to ~18-48N/120-155E)**: cheap, no code change, picks up ~105-285 real upstream cells the current rectangle needlessly excludes (including real walls just west of Yonaguni and north of Hokkaido) -- but only fixes the box-EDGE sub-case, does nothing for genuine interior holes like Kuba-jima/Hateruma. Dirty-tracking risk checked and found bounded to the newly-covered periphery (`utils.get_dirty_aggregation_filenames` compares each item's own content string, not a national flag).
- **Option 2 (RECOMMENDED) -- post-merge synthetic flat-0m fill**: after `merge_japan_bundles.py`, splice in (via the same `pmtiles merge` mechanism already trusted for the z0-7 overview) a synthetic archive containing one 0m Terrarium tile replicated at every currently-absent z8-z16 position inside a generous Japan-region box (proposed ~15-52N/116-160E, chosen so the new box edge itself sits >300km from any Japanese land). Measured (not estimated) cost: `pmtiles`'s own content-dedup + Hilbert-run-length-coalescing collapses a byte-identical fill to **under 1MB total on a 273GB archive** (z8: 235 fill tiles -> 28 directory entries; z11: 14,711 -> 140; z12-16 extrapolated to ~3,000-4,000 entries total). Verified directly: `pmtiles merge` handles interleaved-but-disjoint inputs correctly (tested with synthetic even/odd-x archives), and safely REFUSES on any accidental overlap (`Failed to merge ... Inputs must be disjoint`, naming the exact colliding tile) -- a real safety net against a fill script mistakenly overwriting real data. Also found: the exact fill tile already exists in the real archive (`z12/3454/1742`, a 52-byte WEBP, RGB(128,0,0)=0.0m) -- no new encoding convention needed, reuse verbatim. Named hazards for the eventual implementation: writes must be in ascending tile-ID order (out-of-order write would balloon to ~20M in-RAM Python objects); enumerate the real archive's own directory once rather than probing 20M positions; `check_pmtiles_integrity.py` needs to learn about the fill (`addressed_tiles_count` rises ~3.46M -> ~23M); and lineage should get its own new "synthetic fill" category byte so provenance stays honest rather than silently misattributing fill to GLO-30.
- **Option 3 (serving-layer 204->flat-0m at the Cloudflare edge)**: minutes of work, zero archive change, zero risk -- but fixes the symptom only for `stars`' own viewers; the published `.pmtiles` file itself (what Source Cooperative users, Oliver Wipfli, and offline consumers actually get) stays holed. Not acceptable as the final answer given D160's supplier obligation, but a reasonable immediate stopgap for the live viewer while Option 2 is built.
- **Option 4 (splice upstream's own global product deeper than z7)**: refuted empirically -- upstream has the identical 404s (see Question 1's bonus finding), nothing deeper to splice.
- **Option 5 (add a synthetic 0m source into `source-store/` as an 8th priority tier)**: rejected -- `aggregation_covering.py` would force real aggregation work items at z12 across the ENTIRE box (~132,000 macrotiles running gdalwarp for constant output), and would change every macrotile's `group_id`, plausibly marking the entire national aggregation dirty right before 2号. Still only reaches z12 even at that cost.

**Recommended sequencing**: Option 3 now as a zero-risk immediate stopgap for the live viewer; Option 2 as the real, before-2号 fix (validate against Hateruma/Kuba-jima specifically before trusting it nationally); Option 1b opportunistically once its dirty-tracking blast radius is fully confirmed; report the shared upstream gap to Oliver Wipfli separately.

**One gap in this investigation**: the agent's own attempt to get an independent Opus design review of this proposal (matching this project's own explicitly validated discipline) did not return an actual critique within the investigation's own runtime -- it self-verified its three highest-priority gating items instead (pmtiles merge's interleaved-disjoint-input behavior, its collision-refusal safety net, and dirty-tracking's per-item scope) and explicitly flagged that a real independent review is still needed before any code is written. A second, independent Opus review agent was launched directly (not nested) to close this gap; still running as of this entry.

**Decision (Hidenori, 2026-09-17)**: "欠損位置に合成0mタイルを差し込むことを承認する" -- Option 2 (post-merge synthetic flat-0m fill) approved as the direction. Implementation to proceed once the independent design review above returns and any issues it raises are folded in -- not skipping that step even with the direction now approved, per this project's own standing practice.

### The independent design review landed -- and materially corrected the scope. Code not written yet; both agents now agree on that.

The review the previous section flagged as outstanding did complete (the investigating agent's own nested delegation, which had appeared to hang, actually returned after ~44 more minutes). It confirmed §1 (genuine upstream gap) and §2 (nationwide scope) unchanged, independently reproduced the z8-z11 run-length table exactly (28/54/91/140 -- a real, meaningful cross-check), and independently re-verified the three self-checked gating items (interleaved-disjoint merge behavior, collision-refusal safety net, per-item dirty-tracking scope). But it found a first-order scoping error the original design missed, plus two genuinely gating open questions:

**Scoping correction**: the Copernicus sea source's own native resolution tops out at maxzoom 12 -- so z13-z16 is LAND-ONLY territory (measured: z8-z12 each hold a constant 0.654% of world tiles; z13-z16 each hold a constant 0.0579%). The original "fill every absent position z8-z16 inside a generous box" design therefore meant synthesizing the ENTIRE deep ocean at z16 resolution, not patching a ragged coastal edge: ~86M fill positions (not ~20M), ~20k directory entries (not ~3-4k), `addressed_tiles_count` inflating ~26x (~90M, not ~23M). The affordability conclusion itself survives (~20k entries is still well under 1MB), but the "teach `check_pmtiles_integrity.py` about the fill" hazard is far more load-bearing than first written.

**Two gating questions, neither yet resolved, that determine the ACTUAL required fix size**:
1. **Does MapLibre's terrain renderer actually render -32768m broadly across all of deep ocean at z13+ today**, given the archive's own TileJSON declares a flat nationwide maxzoom=16 (so any viewer legitimately requests z15/16 tiles over the ~68% of the country where real coverage stops shallower, e.g. at z12 for sea-only areas) -- **or does MapLibre's own parent-tile-fallback mechanism (substituting a coarser ancestor tile when the exact zoom isn't available) already gracefully rescue most of this in practice**, meaning the visible walls at Hateruma/Kuba-jima are a narrower, specific case (a present tile sitting directly adjacent to an absent one at the SAME zoom) rather than evidence the whole ocean is rendering as a pit. If the fallback rescues it, the real fix might be as small as 235 tiles / 28 directory entries (a z8-only fill); if it doesn't, the fix genuinely needs the full ~86M-position depth. **This is the single biggest scope determinant and hasn't been tested either way.**
2. **Does narrowing TileJSON's declared `bounds` to a Japan region suppress MapLibre's own out-of-bounds tile requests entirely** (via its `TileBounds`/`hasTile` logic), potentially eliminating the outer-boundary cliff with zero archive bytes needed? Complication, explicitly flagged as **Hidenori's own product-scope call, not a technical one**: TileJSON has exactly one `bounds` field, so narrowing it would also suppress the existing spliced z0-7 global overview OUTSIDE Japan -- trading "no global elevation coverage outside Japan" for "no wall at Japan's own coverage edge." Doesn't address interior holes (Kuba-jima/Hateruma) either way.

**Other real findings, independent of the two gating questions above**:
- `pmtiles merge` copies JSON metadata (including `encoding: terrarium`) from its FIRST input archive only -- passing the fill archive first would silently destroy the real archive's own encoding metadata. A concrete, easy-to-get-backwards ordering requirement for whatever runbook step eventually does this.
- **A real `pmtiles` (protomaps/go-pmtiles) bug, found and reproduced**: when a run-length-coalesced run of tiles spans a ZOOM boundary, `finalize()` computes the archive's own `max_zoom` metadata from the run's START position only, ignoring `run_length` -- demonstrated with a constructed test archive reporting `max_zoom: 7` while it actually addresses z8 tile ids, and **`pmtiles verify` passed this corrupted-metadata archive without complaint**. Worth reporting upstream to `protomaps/go-pmtiles` independent of whatever this project ends up doing -- it's a latent gap in a tool many projects trust.
- Recommends ONE three-way `pmtiles merge` (real archive + z0-7 overview + fill archive together) rather than two sequential two-way merges, since each merge pass rewrites the full ~273GB archive and needs matching free headroom -- avoids repeating that cost, relevant given this project's own D169/D171 ENOSPC history.
- **A better fill-tile choice**: reuse a genuine ALL-NODATA tile already present in the real archive (found: `8/215/108`, 190 bytes, alpha=0 throughout its whole 512x512) rather than fabricating a new "opaque flat 0m" tile as the original design proposed -- keeps the existing alpha=0 "genuinely no data" convention honest instead of introducing a second, semantically different "fake but opaque 0m" convention alongside it.
- **Option 1b (widen `jpnationalsea`'s box) re-rated cheaper/safer than first written**, and should be sequenced EARLIER, not opportunistically-after: its own dirty-tracking blast radius is settleable with a cheap, real dry run (`aggregation_covering.py` into a disposable throwaway generation id, diff via `utils.get_dirty_aggregation_filenames`) -- no actual downloads needed to test it. Every real upstream cell it recovers is one position the fill mechanism doesn't need to fake.

**Reversed from the earlier recommendation, both agents now agree**: **do NOT do Option 3 (the Cloudflare-edge 204->flat-0m stopgap)**, not even as a temporary measure. The original design's own writeup already contained the counter-argument and didn't follow it: a Worker silently rewriting 204s makes `stars` no longer a faithful live view of the actual published archive -- which would blind the exact D79/D172 visual-spot-check practice that FOUND this defect in the first place, and would also mask gating question 1 above (whether deep ocean at z13+ is really rendering as a pit right now), which needs to stay directly observable to settle. The defect is real but has been live, unnoticed, for months, is cosmetic, and affects two near-uninhabited islets -- not urgent enough to trade away this project's own primary regression-detection method for a quick cosmetic patch.

**Revised next steps, in order** (supersedes the "next steps" list earlier in this entry):
1. Settle gating question 1 (does MapLibre's parent-tile fallback rescue broad missing regions, or does the whole deep ocean at z13+ already render as a pit) -- either a live browser test, or reading MapLibre GL JS's own raster-dem/terrain source code directly for its actual missing-tile behavior.
2. Settle gating question 2 (does narrowing TileJSON `bounds` suppress out-of-bounds requests) by reading MapLibre's own `TileBounds`/`hasTile` source -- then bring the global-overview-outside-Japan tradeoff to Hidenori as an explicit product decision, not a technical default.
3. Run Option 1b's dirty-tracking dry run (cheap, no downloads) to find its real recovery scope and shrink whatever the fill mechanism needs to cover.
4. Only then scope Option 2's actual fill size against what's left after 1-3, using the single-three-way-merge approach and the existing-all-nodata-tile reuse.
5. Formally close Options 1 and 5 (both correctly rejected on the evidence gathered).
6. Report the shared upstream GLO-30 inventory gap to Oliver Wipfli, and separately consider reporting the `pmtiles` `max_zoom`/run-length metadata bug to `protomaps/go-pmtiles`, independent of this project's own fix.

**Status: code should not be written yet.** Both the investigating agent and its own independent reviewer converged on this same conclusion from different angles -- the mechanism (Option 2's `pmtiles merge` splice approach) is sound and thoroughly verified, but its actual required SCOPE is still genuinely unknown pending gating questions 1 and 2.

### Gating question 1, answered directly by reading MapLibre GL JS's own source and its GitHub history: this is a real, currently-open (as of 2 weeks ago) upstream MapLibre bug, specific to how it mishandles a 204 response -- NOT necessarily the exact "-32768m uniform pixel" mechanism D113-D118 originally diagnosed

Read MapLibre's own source directly (via `gh api` against `maplibre/maplibre-gl-js`, not guessing) at three points: `main` (current dev), and the actual tag this project's viewer loads (`unpkg.com/maplibre-gl@4` currently resolves to a real, pinned **4.7.1**, confirmed via a live redirect check).

**`main`'s current `RasterDEMTileSource.loadTile()`** explicitly handles a 204 response cleanly: `if (!response.data) { tile.state = 'loaded'; return; }`, with a comment citing issue #1551 by number and explaining this avoids "building a degenerate [DEM] that would fail against its neighbors in `backfillBorder`." This code does NOT exist in v4.7.1 (confirmed by fetching that exact tag's source) -- v4.7.1's equivalent code is `if (response && response.data) { ...build DEM... }` with **no `else` branch at all**, meaning a 204 (where `response.data` may or may not be truthy depending on how the browser/fetch layer represents an empty body) either silently skips DEM construction entirely (tile state never resolves) or, per the actual bug report below, gets built from degenerate data.

**The exact matching bug, found via the issue/PR graph**: PR #5392, "Fix raster-dem glitches for 'no content' tiles (status 204)" (currently **unmerged**, still open), diagnoses precisely this project's own situation: *"Raster-DEM sources like **Martin** return 204 when there is no content. Maplibre stores such tiles as 1x1 images (introduced in PR #3428). **This creates glitches while rendering. Elevation looks random and there are backfill errors.**"* -- Martin is this project's own tile server (`stars.optgeo.org`, per `CLAUDE.md`). This is about as close to an exact match to this project's own symptom as an upstream bug report gets.

**The actual fix, PR #8207 ("Treat an empty raster or raster-DEM tile response as no data (#1551)")**, merged to `main` on **2026-09-03 -- 14 days before this entry**, `Assisted-By: Claude (claude-fable-5)` per its own PR body. Not yet in any tagged/published release as of this entry (no release since that merge date found). So: **this project's own live viewer, and very likely `mapterhorn.com`'s own official viewer too (whatever MapLibre version it pins), are currently running code with this exact, just-fixed-but-unreleased bug.**

**What this changes and doesn't change**:
- It gives gating question 1 a real, sourced answer: 204 responses DO cause visible rendering problems in the currently-deployed viewer stack -- confirmed as a known, reproduced, upstream-acknowledged bug, not a guess. Whether the SPECIFIC visual shape at any given location is a uniform -32768m cliff (D113-D118's own original characterization, possibly accurate for whatever MapLibre version was live when THAT investigation happened) or the "elevation looks random"/"backfill errors" glitch PR #5392 describes doesn't change the actionable conclusion: 204s inside the archive's own effective coverage are unsafe with the MapLibre versions in real use today.
- It does NOT reduce the need for Option 2 (making the published `.pmtiles` archive itself never return 204 within its declared Japan coverage) -- if anything it strengthens the case: this is a genuine, currently-unreleased upstream fix that this project cannot control the timing of, and D160's own "reliable Japan data supplier" framing means OTHER consumers (Source Cooperative users, Oliver Wipfli, offline/desktop tools, anyone on an older or different MapLibre version, or a non-MapLibre renderer entirely) still need the archive itself to be correct, not just this project's own viewer patched.
- It DOES add a new, genuinely cheap, low-risk, non-deceptive option worth tracking separately from the archive-level fix: **once a maplibre-gl-js release containing commit `c36bd575` ships, bump `index.html`'s own `unpkg.com/maplibre-gl@4` pin to it (or to whatever major version contains it).** Unlike the already-rejected Option 3 (Cloudflare edge silently rewriting 204s), this doesn't hide or falsify anything the archive actually contains -- the 204s stay fully visible/inspectable via direct tile requests, this just makes the VIEWER handle genuine absence gracefully instead of glitching. Doesn't blind the D79/D172 visual-check practice at all. Worth doing whenever available, independent of and not a substitute for Option 2.

**Checked**: `maplibre-gl`'s own npm registry shows `latest` is currently **6.10.0, published 2026-09-15 -- two days before this entry** -- and directly confirmed (fetching that exact tag's source) it already contains the fix. So this isn't a "wait for a release" situation at all; **the fix is already publicly available today**, just two major versions ahead of what this project's viewer currently pins (`unpkg.com/maplibre-gl@4` -> 4.7.1). Bumping `index.html`'s pin from `@4` to `@6` (or to whatever's current at the time) is a real, immediately-actionable, cheap experiment -- though a two-major-version jump should be smoke-tested against this project's own actual usage (`Map`, `TerrainControl`, `NavigationControl`, `ScaleControl`, `setTerrain()`) before trusting it blindly, since major version bumps can carry breaking API changes even when this project's own usage looks basic.

### The independent design review's own findings: real, load-bearing blockers, none of them fatal to Option 2 -- a staged, corrected design emerges

A second, independently-launched Opus review agent (not nested inside the investigating agent this time) delivered a thorough, adversarial critique of `DESIGN_wall_fix.md`. Verdict: **"Do not implement as written."** The `pmtiles merge`-splice mechanism itself is confirmed sound, but three concrete parameters in the design were wrong in ways that would have produced real damage. Full findings:

**What independently verified as correct, stated plainly rather than re-litigated**: 0m is exactly the right fill value (real neighboring tiles near Kuba-jima decode as byte-identical 52-byte, 3-channel WEBP, exactly 0.0m, no alpha -- so a fill using the SAME bytes is provably seamless, not just plausible); no second wall mechanism exists at the pixel level (audited all 1,362 present z9+z10 tiles with an absent neighbor -- every alpha=0 pixel found decodes to 0.0m via raw RGB, never -9999, confirming D165 #1's nodata restoration doesn't leak into present tiles); the ascending-write-order RAM mitigation is real and cheap (benchmarked: 2,000,000 identical writes -> 1 directory entry, 0.2us/tile, so even 86M ordered writes is ~20 seconds); isolation from 2号's own aggregation/dirty-tracking is correctly scoped (genuinely post-merge-only); Options 1/4/5 remain correctly rejected.

**BLOCKER 1 -- the proposed fill box would stamp fake 0m sea level over REAL foreign land.** Checked against the real archive: positions currently absent, inside the proposed 15-52N/116-160E box, include Luzon/Baguio (a real 2,922m mountain), northern Sakhalin, southern Kamchatka, and Beijing -- all real land this project simply never downloaded, not open ocean. Publishing "Luzon is at sea level" inside an archive upstream Mapterhorn consumes (D160's own supplier obligation) is a silently WRONG answer, strictly worse than an honest gap (which is at least self-reporting). **Fix, and it costs nothing**: `source-catalog/glo30/file_list.txt` is already, for free, a global 1-degree land mask (confirmed it contains the Luzon/Sakhalin/Kamchatka/Beijing cells, and confirmed it's genuinely empty for real open-ocean control cells) -- fill a position only when EVERY 1-degree cell it touches is absent from that global inventory. This automatically includes the real wall cases (N26E123/N23E123/N23E124, all independently confirmed 404 upstream) and automatically excludes every foreign landmass, and cleanly separates Option 2's job (fill genuine no-data-anywhere-upstream gaps) from Option 1b's job (recover real upstream cells this project just never downloaded).

**BLOCKER 2 -- z13-z16 is 99.8% of the fill's total cost, resting on an assumption nobody actually tested.** Measured real tile counts per zoom in the published archive show z14/z15/z16 each exactly 4x the previous zoom's count -- deep zooms exist only over land and near-shore water (the D149/D166 upsampling feature), open sea itself stops at native z12. So filling z13-z16 doesn't patch a ragged coastal edge, it synthesizes the ENTIRE deep ocean at z16 resolution: measured fill requirement is ~85.9M tiles total (not the original document's ~20M), of which z13-z16 alone is 99.76%. Whether this is even NECESSARY is unresolved either way: checked ancestor-chain availability at both known wall locations and at a sea position 30km off Tsushima -- "has a present ancestor tile" does NOT reliably prevent a wall (both known walls have a present z0-z8 chain and an absent z9), which argues z13+ offshore walls plausibly ARE real too, but nobody has actually looked. **Recommendation: settle this empirically first (open the live viewer in 3D at z14 over open water ~30km off Tsushima), then stage the fill** -- z8-z12 only in a first pass (204,856 tiles, ~1,241 directory entries, +5.9% tile count, captures BOTH of the actual known/reported wall locations since both are at z9) -- and only extend to z13-z16 if walls are actually confirmed to persist there.

**BLOCKER 3 -- the fill breaks this project's own integrity gate, two distinct ways.** (a) 384 of the 648 z8 fill tiles in the proposed box would have no z7 parent (the existing z0-7 global overview is itself holed, per upstream's own 404s over ocean) -- taking the elevation archive from D172's own "CLEAN, zero orphans" finding to a real, new, >0 orphan count; not mentioned anywhere in the original design. (b) `check_pmtiles_integrity.py`'s own in-memory Python-set representation costs a measured 163 bytes/entry -- at the full ~86M-tile fill scope, that's ~13.4GiB, OOM risk on this 16GB machine (CPU cost is fine, ~5.6 minutes). Under the staged z8-z12 scope from Blocker 2, this drops to a comfortable ~0.57GiB. **Fix**: either restrict the fill to positions with a genuine z7 ancestor, or -- cleaner -- first complete the z0-z7 global overview itself (only 8,321 missing positions globally out of 21,845, `build_global_overview.py` already has roughly this shape, and 0m-over-ocean is correct there too) before filling z8+; separately, `check_pmtiles_integrity.py` needs a more memory-efficient representation (sorted array/bitmap, not a Python set of tuples) before any deep fill ever lands, regardless of scope.

**MAJOR 4 -- as described, this implies an uncounted THIRD full 273GB archive rewrite.** Splicing the fill in AFTER the existing z0-7 splice (two sequential 2-way merges) means rewriting the full archive twice more, each needing matching free headroom -- avoidable, and worth avoiding given D169/D171's own ENOSPC history. **Fix**: `pmtiles merge` accepts N disjoint inputs at once -- fold the fill into the EXISTING z0-7 splice as a single 3-way merge (`./pmtiles merge <z8plus> <global-overview> <fill> <final>`), keeping `z8plus` FIRST so `merge_japan_bundles.py`'s own documented "metadata copied from the first input only" property is preserved. Needs verifying the 3-input output still comes out `clustered=True` (D141 observed this holds for a 2-input merge; a 3-input merge's own behavior here is unverified).

**MAJOR 5 -- the "<1MB" conclusion survives, but the reasoning behind it was wrong.** The original document's "roughly doubles per zoom" extrapolation is contradicted by measurement: the actual run-count jump from z12 to z13 is 3.9x, not 2x, because the present-tile fraction collapses from ~42% of the box to ~3.7% at that boundary. Real corrected total is ~22,000 directory entries (not the original ~3,000-4,000 estimate) -- the affordability conclusion itself still holds (still well under 1MB), but by a less rigorous path than presented; worth fixing the document's own reasoning since the same extrapolation style could get reused somewhere the luck doesn't hold.

**MODERATE 6 -- the fill would destroy a verification technique this project has ALREADY used, this same session.** This very entry's own D165-#1 refutation relied on diffing tile presence between the 1.5号 and 1.6号 archives position-by-position. Once every position inside the fill box is uniformly present, that diagnostic goes dead for every future generation -- a real coverage regression in 2号 would no longer show up as a missing tile. **Recommended, cheap fix that also answers this entry's own earlier open question 3 (whether/how to record fill provenance)**: retain and publish the small (<1MB) per-generation fill archive itself as a permanent artifact alongside the main one. It's exactly the record of "which tiles are synthetic" (`real = final - fill`, recoverable by diff at any time), a better provenance answer than a new lineage category byte, and costs one `cp`.

**MODERATE 7 -- do not fill the lineage archive; it would amplify an already-open defect for zero benefit.** Lineage has `min_zoom=4`, no global overview of its own, and already carries D172's own unresolved 116-tile z8 orphan gap. Filling lineage's z8 across the same box would add roughly 648 new z8 tiles, nearly all without a real z7 lineage parent -- hundreds of new orphans stacked on an already-open finding. And lineage is never rendered as 3D terrain, so there's no wall to fix there in the first place. Use finding 6's retained fill archive as the provenance record instead, and note the fill's existence in the lineage archive's own `description` metadata string (which `merge_japan_bundles.py` already sets at generation time) rather than a new per-pixel category byte.

**MINOR 8 -- this entry's earlier open question 5 (narrowing TileJSON `bounds`) is already answered, not still open.** The final archive's global header bounds exist SPECIFICALLY BECAUSE of the z0-7 splice -- narrowing `bounds` to a Japan box would crop away the entire global overview, the one thing that splice exists to provide. The lever is unavailable by construction; close the question rather than carrying it into implementation.

**MINOR 9 -- one real, cheap, unverified risk worth a gating test before any full-depth fill.** Python's own `pmtiles.writer.Writer` was directly verified to hold run-lengths compactly (Hazard #1's own benchmark above). `go-pmtiles`'s own `merge` command's in-memory handling of an 86M-addressed-tile input was NOT verified the same way -- if its Go implementation expands runs rather than coalescing them the same way, that's plausibly several GB on this 16GB machine. A 10-minute synthetic-archive test (build a ~20M-addressed-tile RLE fill archive, merge it against a small real archive, watch RSS) would settle this before committing to full depth. Evaporates entirely under the staged z8-z12 scope from Blocker 2.

**2号 interaction**: the fill set is defined relative to whatever's actually in the archive, so it must be regenerated for every future generation -- fine and near-free IF folded into the single 3-way merge call (Major 4), but a real silent-failure risk otherwise: since `publish_cycle.py` is hard-disabled (D115) and the publish runbook is manual, a future session that forgets this one extra step gets no error at all, just a silent return of the walls. **Recommended**: have `merge_japan_bundles.py` (or whatever eventually succeeds it) generate/apply the fill archive as an intrinsic part of its own run, so the step structurally cannot be skipped, and add it to `CLAUDE.md`'s own documented pipeline command list right alongside the existing z0-7 splice step.

**On Option 3 (the Cloudflare 204->0m stopgap)**: still a reasonable immediate move on its own terms, and nothing above blocks it -- but do the z14-over-open-sea live-viewer look (Blocker 2's own gating test) BEFORE deploying it, since the stopgap would mask exactly the artifact that test needs to observe.

### Summary of required changes before any implementation (this review's own numbering)

1. Replace the rectangular fill box with the GLO-30-global-inventory land mask (`source-catalog/glo30/file_list.txt`) -- fill only where every touched 1-degree cell is absent upstream. **Blocker.**
2. Stage the fill at z8-z12 first (captures both known/reported wall cases); settle the z13+ question empirically in the live viewer before committing to the other 99.8% of the fill's cost. **Blocker.**
3. Make the pyramid orphan-free by construction (complete z0-7 first, or require a real z7 ancestor), and fix `check_pmtiles_integrity.py`'s memory model before any deep fill lands. **Blocker.**
4. Fold the fill into the existing single `pmtiles merge` call as a third input, `z8plus` first. **Major.**
5. Correct the ~20M/~3,000-entry figures and the "doubles per zoom" extrapolation reasoning in the design document itself. **Major.**
6. Retain and publish the per-generation fill archive as the provenance record; do not fill lineage. **Moderate.**
7. Close the `bounds`-narrowing question as answered (unavailable, not just undesirable); add a `go-pmtiles` merge RSS gating test only if full z13+ depth is ever actually pursued. **Minor.**

**Net effect on this entry's own recommended path**: adopt the STAGED, corrected design -- z8-z12 fill only, using the free inventory-mask box (not the original rectangle), folded into the existing single 3-way merge, with the z0-7 overview itself completed first if needed for orphan-freedom, the fill archive retained as its own small published artifact, lineage left unfilled, and the z13+ question deferred until the live-viewer z14-over-open-sea check can actually be done. Still not yet implemented as of this entry -- the one remaining empirical gate (the z14 live-viewer look) needs either a live browser (unavailable in this headless session, per this session's own earlier `claude-in-chrome` connection check) or Hidenori's own direct check.

## D175: Bumped the preview viewer's MapLibre GL JS pin from v4 to v6 -- a cheap, real, non-deceptive mitigation for the wall's VIEWER-SIDE symptom, independent of D174's archive-level fix

**Status**: Done, verified as thoroughly as possible without a live browser. `index.html`/`app.js` (`mapterhorn-japan-bridge` repo's own GitHub Pages preview) now load `maplibre-gl@6` instead of `@4`. Not yet visually confirmed in an actual browser -- this session has no working browser connection (`claude-in-chrome` unreachable, headless `slate`); recommend a quick live check once published.

**Why now, and why this specific piece**: Hidenori's own call (2026-09-17), given `stars` was mid-soak-test and unavailable for the heavier archive-level work -- this piece is fully independent (touches only the GitHub Pages preview, no pipeline/archive interaction) and safe to do in parallel. Directly follows from this entry's own earlier finding: PR #8207 (merged to `maplibre-gl-js` main 2026-09-03, "Assisted-By: Claude (claude-fable-5)") fixes the exact bug PR #5392 diagnosed by name against this project's own tile server ("Raster-DEM sources like Martin return 204... elevation looks random and there are backfill errors") -- and that fix is live in the current `latest` npm release, **6.10.0, published 2026-09-15**.

**What changed**:
- `index.html`: CSS link `@4` -> `@6`; removed the old `<script src="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js">` entirely (v6 no longer publishes that classic global-exposing bundle at all -- confirmed `dist/maplibre-gl.js` 404s for v6, only `dist/maplibre-gl.mjs` exists, `"type": "module"` in `package.json`, no `main`/`unpkg`/`browser` field); changed `<script src="app.js">` to `<script type="module" src="app.js">` since `app.js` now uses a real ES `import`.
- `app.js`: added `import * as maplibregl from 'https://unpkg.com/maplibre-gl@6/dist/maplibre-gl.mjs';` at the top -- a namespace import, chosen specifically so every existing `maplibregl.Map`/`.NavigationControl`/`.ScaleControl`/`.TerrainControl` call in the file needed zero further changes (v6's bundle exports only named exports, no `default`, confirmed by reading the actual bundle's own `export {...}` statement).

**Verification done without a browser** (this session's `claude-in-chrome` connection is down, `slate` is headless):
- Confirmed via live HTTP checks that `dist/maplibre-gl.mjs` and `dist/maplibre-gl.css` both exist and return 200 for v6, that the old `dist/maplibre-gl.js` returns 404, and that `Map`/`NavigationControl`/`ScaleControl`/`TerrainControl` are all present as named exports in the actual served bundle.
- Downloaded the real v6.10.0 `.mjs` bundle (plus its code-split `maplibre-gl-shared.mjs` dependency) and imported it in a local Node process: loads cleanly, `typeof mod.Map === 'function'` etc. for all four needed exports, `mod.getVersion()` reports `6.10.0`. This validates the module's own JS is syntactically and structurally sound and its dependency graph resolves -- it does NOT validate actual browser/WebGL rendering, which Node can't do.
- Read `maplibre-gl-js`'s own CHANGELOG for every `## ` version section between 4.0.0 and 6.10.0 for entries containing "breaking" (⚠️), and checked each one against this project's own actual usage:
  - WebGL2-only requirement (v6): fine, WebGL2 has near-universal modern browser support; this project's viewer is a preview tool, not a legacy-browser-support target.
  - GeoJSON nested-object encoding change: doesn't apply, this project's style has no GeoJSON sources.
  - Icon-offset scaling render change: doesn't apply, no icon layers with offset in `style.json`.
  - `map.setTerrain()` now validates its argument (previously unchecked): app.js's own calls (`{source:'mapterhorn', exaggeration:1}` and `null`) are exactly the documented valid shapes, should pass validation cleanly (and if anything, this is a strict improvement -- catches config mistakes instead of silently accepting them).
  - `raster-dem` sources now validated in `map.addSource()` (previously skipped entirely): `style.json`'s own `mapterhorn` source (`type: raster-dem, encoding: terrarium, tileSize: 512, url: ...`) is a completely standard, spec-compliant definition -- should validate cleanly, and again this is a strict improvement over the old skip-validation behavior.
  - **The one item that specifically needed real verification, not just a changelog skim**: PR #7073 ("refactor!: `UrlSearchParams` based `Hash`") explicitly flagged as breaking the exact `hash: 'hash'` option this project's own `app.js` uses -- the SAME feature that produces the `#hash=z/lat/lon/bearing/pitch` URLs Hidenori shared directly in this conversation for the Hateruma/Kuba-jima wall locations. Read the actual current `src/ui/hash.ts` source (not just the changelog blurb): for a NAMED hash (`hashName` set, exactly this project's own usage), the format is still `params.set(this._hashName, "${zoom}/${lat}/${lng}[/${bearing}][/${pitch}]")` -- i.e. the exact `#hash=z/lat/lon/bearing/pitch` shape is unchanged in the current implementation. The refactor's own breaking-change scope (URLSearchParams edge-case parsing differences) doesn't touch this project's own named-hash format.
- Checked CORS/content-type on the actual served files (a real, if less common, failure mode for cross-origin ESM `import`): `access-control-allow-origin: *` present; the final (post-redirect) response for the unversioned `@6` URL correctly serves `content-type: text/javascript; charset=utf-8` (a raw, non-redirect-following check briefly showed `text/plain` on the 302 redirect stub itself, not the actual final asset -- resolved by checking with `-L`, i.e. following the redirect the same way a browser does automatically).

**Explicitly not verified, and worth a real look before fully trusting this**: actual rendering in a real browser (terrain toggling, the `mapterhorn` raster-dem source loading and decoding correctly, the base `bvmap` vector source, general visual correctness) -- Node execution proves the JS loads and its exports are shaped correctly, nothing about WebGL/Canvas rendering, which this environment cannot test. Per Hidenori's own suggestion, worth asking a peer session with real browser access (e.g. `cafebabe`) or Hidenori's own direct check once this is live on GitHub Pages.

**Scope note**: this fixes the visible symptom only for THIS project's OWN preview viewer. It does not touch, and is not a substitute for, D174's own archive-level fix (Option 2, still pending its own remaining design work) -- other consumers (Source Cooperative users, Oliver Wipfli, the official `mapterhorn.com/viewer`, offline tools, anyone on an older/different MapLibre version or non-MapLibre renderer) are unaffected by this change and still need the underlying archive itself fixed, per D160's own supplier-obligation framing.

## D176: D174's staged fill implemented and verified as a working prototype (script + scratchpad archives), including a real orphan-generating bug found and fixed in the process. Not yet run against production; the z13+ empirical question remains the one open gate

**Status**: Prototype complete and fully verified against real data (including the full 273GB elevation archive). Not yet wired into the actual publish runbook or run against `bundle-store/` -- this entry documents working, tested code and measured results, not a production change. Note: this session was interrupted by an unrelated restart partway through the first implementation pass, wiping the ephemeral scratchpad; everything below was rebuilt from scratch on the corrected design and reproduced byte-for-byte identical results before the bug described here was found and fixed, giving real confidence the process itself is deterministic and repeatable.

**What was built, following the second design review's own corrected recommendations (Blockers 1-3, Major 4)**:
1. `glo30_land_mask.py` -- loads `source-catalog/glo30/file_list.txt` (24,674 global cells) into a set, with `fill_eligible(x, y, z, cells)` returning True only when EVERY 1-degree cell a tile touches is absent from that set. Verified against all 8 of the second review's own named cases (Kuba-jima, Hateruma, Luzon, Sakhalin, Kamchatka, Beijing, two open-ocean controls) -- all passed.
2. A canonical fill tile: generated (not borrowed -- an earlier candidate tile the second review proposed reusing, `8/215/108`, turned out on direct inspection to NOT be uniformly nodata as claimed, so this session generated its own via this project's actual `utils.get_rounded_elevation_data()` + the same RGBA/webp_encode path `save_terrarium_tile()` uses) -- a 512x512 tile, R=128 G=0 B=0 A=0 uniformly (elevation=0.0m, alpha=0 marking it as genuinely synthetic/no-data, not real coverage), encoding to exactly 52 bytes.
3. `build_z0_7_fill.py` -- completes the z0-7 global overview's own 8,321 missing positions (all independently reconfirmed 100% GLO-30-mask-eligible, 0 exceptions, matching this entry's own earlier finding). Output: 560 directory entries, 1,231 bytes.
4. `build_fill_archive_v2.py` -- the z8-z12 staged fill (Blocker 2's scope). First version enumerated each zoom independently against the mask (159,494 positions, 1,178 entries, 2,255 bytes) and merge-tested clean -- but a full-archive orphan check (see below) found this was NOT actually orphan-free. Root cause and fix documented in detail below. Final, corrected version: **152,267 fill positions, 796 directory entries, 1,682 bytes**.

**A real bug found and fixed mid-implementation**: the first z8-z12 enumeration tested each zoom's own mask-eligibility independently, without checking whether a tile's PARENT (one zoom coarser) was itself resolvable. This is a genuine, non-obvious failure mode: a fine child tile's own footprint can touch only GLO-30-absent cells (fill-eligible) while its coarser PARENT's larger footprint touches one additional cell that DOES have upstream data -- making the parent fill-*in*eligible under Blocker 1's own safety rule -- and if that parent is ALSO absent from the real archive (for unrelated reasons, e.g. a boundary macrotile with no real aggregation coverage), the child becomes a genuine orphan. Concretely traced one example: child `z9/465/233` touches only cells (15,146)/(15,147), both GLO-30-absent (eligible); its parent `z8/232/116` touches (15,146)/(15,147)/(16,146)/(16,147) -- one of the latter two IS present in GLO-30, making the parent ineligible -- and the parent is also genuinely absent from the real archive. A precise, full-archive check (every fill position's parent tested against the real 273GB elevation archive, the real z0-7 overview, AND both fill sets -- not a cheap proxy) found **759 such genuine orphans** in the first version (0 at z8, since z0-7 is independently complete; 54/78/181/446 at z9/z10/z11/z12).

**Fix**: rebuilt the z8-z12 enumeration top-down (z8 first), gating each position on its PARENT being already resolvable -- present in the real archive, in the z0-7 fill (for z8's own z7 parent), or already decided into this same fill set at the previous zoom (for z9-z12). A position whose parent fails this chain is simply left unfilled (stays a genuine 204) rather than risk an orphan -- strictly more conservative than the first version; the fill count can only shrink, never grow, as a result. **A second bug was caught immediately when first testing this fix**: the initial z8 branch checked the parent's resolvability only against the real z0-7 overview archive, forgetting to also check the z0-7 FILL archive built in step 3 above -- this wrongly rejected all 8,321 already-filled z0-7 positions as "unresolvable," collapsing the total fill to a wildly wrong 27,127. Fixed by loading and consulting the z0-7 fill's own position set too. Final result, reverified: **z8 shows 0 "parent not resolvable" skips** (as it should, given z0-7 is independently 100% complete), and the corrected total (152,267) is close to but smaller than the naive first pass (159,494) by exactly the 7,227 positions whose parent genuinely couldn't be resolved -- these stay real, unfilled 204s, a conservative and correct outcome, not a shortfall.

**Final verification, this session, against real data**:
- `pmtiles verify` passes cleanly on both fill archives individually.
- A precise, full-archive orphan check (every one of 160,588 combined fill positions' parent tested against the real 273GB elevation archive + real z0-7 overview + both fill sets, not a cheap proxy or a limited-scope test merge) found **zero genuine orphans** -- the corrected design is orphan-free by construction, confirmed empirically, not just argued.
- A real `pmtiles merge` (Major 4's single-call approach: real z0-7 overview first for correct metadata inheritance, then the z0-7 fill, then the z8-z12 fill, in one call) succeeds cleanly, `pmtiles verify` passes on the output, `clustered: true` preserved, `addressed_tiles_count` (174,112) matches the exact expected sum (13,524 real + 8,321 z0-7-fill + 152,267 z8-z12-fill) with no discrepancy.
- Both originally-reported wall positions (`9/431/216` north of Kuba-jima, `9/432/221` south of Hateruma) decode from the merged test archive as exactly 52 bytes, elevation=0.0m uniformly, alpha=0 uniformly (correctly marked synthetic, not real coverage) -- the two concrete symptoms that started this whole investigation are directly, empirically fixed in this prototype.

**Not yet done, i.e. what's still between this prototype and an actual production change**:
1. This prototype only merge-tested against the small (3.2GB) z0-7 overview, never against the full 273GB real elevation archive (too expensive to do repeatedly during iteration) -- the orphan check WAS run against the full real archive directly (cheap, directory-only reads), but a true production run needs one real end-to-end `pmtiles merge` with all of: real elevation archive, real z0-7 overview, z0-7 fill, z8-z12 fill, in the correct order, then `pmtiles verify` + `check_pmtiles_integrity.py` (itself needing the sorted-array/bitmap rewrite the second review flagged, given `addressed_tiles_count` will roughly double).
2. `check_pmtiles_integrity.py` has not yet been updated for the new tile-count scale.
3. Nothing has been wired into `merge_japan_bundles.py`'s own runbook yet (the second review's own recommendation: make fill-generation an intrinsic, unskippable part of that script's own run, not a separate manual step).
4. The one still-open empirical gate from this entry's own earlier addendum -- whether z13+ open ocean actually shows the wall live in a real viewer -- remains unresolved, and determines whether this z8-z12-only scope is the FULL fix or needs a later follow-up extension.
5. This entire prototype has been scratchpad-only Python against the LOCAL `bundle-store/` copy -- nothing in `stars`' own live archive has been touched, and no republish has happened.
6. This fix has not been applied to the lineage archive (per the second review's own recommendation, D174, MODERATE 7 -- deliberately not planned, lineage has no 3D wall to fix and already carries its own D172 orphan gap).

Scripts live in this session's own scratchpad (`glo30_land_mask.py`, `build_z0_7_fill.py`, `build_fill_archive_v2.py`, `check_orphans_precise.py`) -- not committed to `hfu-mapterhorn`, per this project's own "one-off verification scripts stay local until proven" convention. Worth promoting to real, committed pipeline code once the z13+ question is settled and a production run is actually approved.

### Promoted to real, committed pipeline code -- `hfu-mapterhorn/pipelines/build_wall_fix_archive.py` (`d7eedee`) -- and a real regression caught during promotion

Given this scratchpad has already been wiped once this session by an unrelated restart (losing real, verified work that had to be rebuilt from scratch), the scratchpad-only prototype above was consolidated into a single, real, committed script -- `build_wall_fix_archive.py`, two subcommands (`z0-7`, `z8-z12`) sharing the GLO-30 land-mask and top-down parent-gating logic, following `build_global_overview.py`'s own established conventions (TMPDIR override before `tempfile` resolves it, argparse CLI, atomic tmp+`os.replace()` write matching `utils.create_archive()`'s own rationale).

**Promoting the logic reintroduced the exact class of bug D176 had already found and fixed once**: the committed script's own `build_z8_z12()` checked z8's own parent (z7) resolvability against ONLY the z0-7 fill archive's positions, not the real z0-7 overview archive itself -- the same mistaken "z0-7 fill alone is 100% complete" reasoning D176 already caught and fixed in the scratchpad version, reintroduced fresh while rewriting the logic into the committed script. **Caught immediately by re-running the promoted script against real data and diffing against the scratchpad prototype's own already-verified numbers**: the committed script's first run gave 129,015 total fill positions (z8=384, z9=1,535, z10=6,114, z11=24,281, z12=96,701) -- visibly different from, and about 15% smaller than, the prototype's own verified 152,267. Root-caused to the missing `bool(r_ov.get(7, px, py))` check (the real z7 archive presence), fixed by adding an `--overview` argument to the `z8-z12` subcommand and checking both the real overview AND the z0-7 fill for z8's own parent resolvability, exactly matching the scratchpad version's own already-correct logic.

**Re-verified after the fix, against real data, matching the prototype exactly**: `z8=463 z9=1,825 z10=7,221 z11=28,657 z12=114,101`, **152,267 total, 796 directory entries** -- identical to D176's own scratchpad numbers at every zoom, not just in total. `pmtiles verify` clean on both fill outputs; a full-archive orphan check (same method as D176's own, against the real 273GB elevation archive) found **zero genuine orphans**; a real 3-way `pmtiles merge` (real z0-7 overview, z0-7 fill, z8-z12 fill) succeeds and verifies clean.

**Lesson worth carrying forward explicitly**: a bug found and fixed once in a prototype is not automatically safe once the same logic is retyped into a "cleaner" committed version -- re-verify the promoted code against the prototype's own already-trusted numbers, not just against pmtiles' own structural checks (which caught nothing wrong here; both the buggy 129,015 version and the correct 152,267 version passed `pmtiles verify` and would very likely have passed a naive orphan check too, since under-filling can't create orphans, only leave more genuine 204s than necessary -- a subtler, quieter failure mode than the original over-filling bug, and one that would have shipped a materially incomplete fix without this specific cross-check against known-good numbers).

All testing above ran against throwaway output paths (`/tmp/wall_fix_test_out/`, cleaned up afterward) -- `bundle-store/` and `stars` remain untouched. Still not wired into `merge_japan_bundles.py`'s own runbook; still gated on the z13+ empirical question before a production run.

## D177: The z8-z12 wall fix run for real, against `bundle-store/`. Local swap done, clean on every check. Publish to `stars` pending one more explicit go-ahead

**Status**: Production run complete and fully verified locally. `bundle-store/mapterhorn-japan-bridge.pmtiles` now IS the wall-fixed archive. NOT yet published to `stars` -- the live public archive is unchanged as of this entry.

**Decision (Hidenori, 2026-09-19, via `AskUserQuestion`)**: proceed with the z8-z12 production run and republish, rather than waiting for the z13+ empirical question -- explicitly scoped as a separate future follow-up, not a blocker. Framing that led to this: D175's MapLibre v6 upgrade already ships upstream's own fix for the specific rendering glitch (PR #8207) for THIS project's own viewer, reducing the urgency of literally seeing the z13+ wall render there specifically -- but the underlying archive-level gap (D174's own "reliable Japan supplier" framing, D160) is independent of that and real regardless, so there was no reason to gate the already-verified, already-scoped z8-z12 fix on an answer that mainly matters for deciding whether to extend further, not whether to ship what's already proven.

**What ran, against real production data (not a copy, not a test path)**:
1. `build_wall_fix_archive.py z0-7 --overview /Volumes/Migrate-2025-04/global-overview-backup.pmtiles --out bundle-store/wall-fix-z0-7.pmtiles` -- **8,321 addressed tiles, 560 directory entries** -- exact match to every prior prototype/test run, byte-for-byte reproducible.
2. `build_wall_fix_archive.py z8-z12 --elevation bundle-store/mapterhorn-japan-bridge.pmtiles --overview ... --z0-7-fill bundle-store/wall-fix-z0-7.pmtiles --out bundle-store/wall-fix-z8-z12.pmtiles` -- **152,267 addressed tiles, 796 directory entries** (z8=463 z9=1,825 z10=7,221 z11=28,657 z12=114,101) -- again an exact match to every prior run.
3. `pmtiles verify` clean on both.
4. `pmtiles merge bundle-store/mapterhorn-japan-bridge.pmtiles bundle-store/wall-fix-z0-7.pmtiles bundle-store/wall-fix-z8-z12.pmtiles bundle-store/mapterhorn-japan-bridge.wallfix.pmtiles` (real archive first, so its own metadata is what gets copied, per Major 4's own finding) -- **succeeded**, output size 272,864,950,554 bytes (only ~3.6KB larger than the pre-fix 272,864,946,957 bytes, matching the "well under 1MB" cost measured throughout this whole design process).

**Full verification against the real merged output, before touching anything live**:
- `pmtiles verify`: clean.
- `pmtiles show`: `min_zoom=0 max_zoom=16`, `addressed_tiles_count=3,621,677` (exact expected sum: D172's own original 3,461,089 + 8,321 + 152,267 = 3,621,677, no discrepancy), `clustered=true`, and -- confirming Major 4's own metadata-ordering fix worked -- `attribution`/`description`/`encoding`/`name` all correctly inherited from the real archive (not the fill archives).
- `check_pmtiles_integrity.py` (this project's own official orphan checker, the same one D172 used to certify the original archive "CLEAN"): **CLEAN -- every tile at every zoom has a parent one zoom coarser, zero orphans**, across the full 3,621,677-tile archive. Per-zoom counts confirm the fill landed exactly where intended and nowhere else: z0-z7 now the full 21,845 (100% world coverage, as designed), z8-z12 each equal to the original count plus the fill count exactly (e.g. z9: 1,725 + 1,825 = 3,550, matching), z13-z16 completely unchanged from D172's own original counts (38,840/155,360/621,440/2,485,760) -- confirming the staged z8-z12-only scope was respected, nothing leaked deeper.
- Both originally-reported wall positions decode correctly: `9/431/216` (north of Kuba-jima) and `9/432/221` (south of Hateruma), each 52 bytes, elevation 0.0m, alpha=0 (honestly marked synthetic). A real, untouched neighbor (`9/431/217`, Kuba-jima's own land) still decodes its genuine 0-93m data unchanged, confirming the fill touched only its intended positions.

**Local swap, done**: `bundle-store/mapterhorn-japan-bridge.pmtiles` (old, pre-fix) renamed to `mapterhorn-japan-bridge.pmtiles.pre-wallfix-20260919` (preserved, not deleted, matching this project's own standing caution around touching data that might still be the live source of what `stars` currently serves -- same reasoning as D171's own 1.5号 archive preservation). `mapterhorn-japan-bridge.wallfix.pmtiles` renamed into the live local path. Local MD5 computation started (background) for the eventual `stars` transfer verification, matching D173's own already-validated transfer-then-atomic-rename publish procedure.

**Provenance retained, per the second design review's own MODERATE 6 recommendation**: `wall-fix-z0-7.pmtiles` and `wall-fix-z8-z12.pmtiles` kept in `bundle-store/` (not deleted) -- together under 2KB, and exactly the record of which tiles are synthetic (`real = final - fill`, recoverable by diff against any future generation).

**Not yet done**: publishing to `stars` (the live, public-facing archive is still the pre-fix version as of this entry) -- holding for one more explicit go-ahead before touching the live service, per this project's own standing practice around irreversible-ish actions on published data. `mapterhorn-japan-bridge-lineage.pmtiles` untouched (per the design's own MODERATE 7, lineage was deliberately not filled). The z13+ extension remains a tracked, explicitly-deferred follow-up, not forgotten -- revisit once the live-viewer empirical check becomes possible.

## D178: Published to `stars`. The wall fix is live. Both originally-reported positions confirmed fixed on the public service

**Status**: Done. `stars`' live `mapterhorn-japan-bridge.pmtiles` is now the wall-fixed archive. Verified directly against the public endpoint, not just locally.

**Decision (Hidenori, 2026-09-19, "進めてよい")**: explicit go-ahead to publish, given as its own confirmation separate from the earlier "run it in production" decision -- kept as two distinct approval points (build+verify locally, then publish live) per this project's own standing practice around touching published data.

**What ran, the same validated transfer-then-atomic-rename procedure from D173**:
1. `scp bundle-store/mapterhorn-japan-bridge.pmtiles stars@stars.local:/home/stars/data/mapterhorn-japan-bridge.pmtiles.new` -- 272,864,950,554 bytes, transferred at the same historically-consistent ~11.5MB/s this project has seen before, monitored throughout with no errors.
2. Remote size confirmed to match the local file exactly on completion.
3. Remote `md5sum` -- **matched the local MD5 exactly** (`8ed3ac39e210e2ad6f187143c4cddf20`), and this time completed quickly (unlike D173's own ~20-hour remote-hash experience) rather than being I/O-starved -- plausibly because `stars`' Phase 2/3 load-testing (the peer coordination earlier in this session) had already concluded by this point, leaving the host's own I/O free.
4. Atomic rename on `stars`: old live file -> `mapterhorn-japan-bridge.pmtiles.pre-wallfix-20260919` (preserved, not deleted -- same caution as every prior publish this project has done), `.new` -> the live filename.

**Verified live against the actual public service, immediately after the rename**:
- TileJSON (`https://stars.optgeo.org/mapterhorn-japan-bridge`): 200.
- **Both originally-reported wall positions now serve correctly**: `9/431/216` (north of Kuba-jima) and `9/432/221` (south of Hateruma) each return **200, 52 bytes** -- exactly the synthetic fill tile's own size, where they previously returned 204. This is the concrete, live, public confirmation of the fix that started this whole investigation (D174) -- not just a local file property anymore.
- A real, untouched position (Mt. Fuji, z13) still returns 200 with its own genuine 108,558-byte real tile, confirming the fill touched only its intended synthetic positions and nothing else.

**This closes out D174's own arc, staged scope**: the wall problem's root cause (a genuine upstream Copernicus GLO-30 inventory gap, confirmed via three independent lines of evidence), its nationwide scope (13.2% of z9 land-containing tiles), the exact upstream MapLibre bug behind the visible symptom (PR #5392/#8207, already mitigated for this project's own viewer via D175's version bump), two independent Opus design reviews that caught and fixed three real blockers (foreign-land contamination risk, an 85.9M-tile scope explosion, and a genuine orphan-generating parent-resolution bug), a verified prototype, promotion to committed pipeline code (catching and fixing a real regression along the way), and now a real production run, fully verified, published, and live. The z13+ extension remains explicitly tracked and deferred (D177's own framing) -- not blocking, not forgotten, revisit once a live-viewer check becomes possible or upstream data changes make it moot.

**State of `bundle-store/` and `stars` as of this entry**: both hold the wall-fixed elevation archive as the live/current version; both preserve the pre-fix version under a dated backup name (`*.pre-wallfix-20260919`) rather than deleting it; lineage untouched on both. `bundle-store/wall-fix-z0-7.pmtiles` and `wall-fix-z8-z12.pmtiles` retained locally as the small provenance record (per the second design review's own MODERATE 6 recommendation).

## D179: Pre-2号 planning pass (2026-09-20) -- consolidated the open-item list, re-verified GSI's trigger status live, and found one real gap: the wall fix has never been written down as a standard step of 2号's own launch procedure

**Status**: Planning/documentation only, no code or data touched. Triggered by Hidenori's own "2号を控えて行うべきことを整理し、計画しよう".

**GSI DEM1A trigger, re-checked live**: `https://service.gsi.go.jp/kiban/app/data_update_info/` still shows 2026-07-31 as the latest 1mメッシュDEM update, no change since the 2026-09-11 check. Consistent with the end-of-November 2026 working estimate (`PLAN.md` §1); nothing triggered yet.

**Both repos confirmed clean and fully pushed** (`git status --short` empty in both, `git log origin/main..HEAD` empty in both) -- `mapterhorn-japan-bridge` at `9b443fc`, `hfu-mapterhorn` at `d7eedee`, matching `HANDOVER.md`'s own D174-D178 snapshot exactly.

**The one real finding**: `build_wall_fix_archive.py` (D176/`d7eedee`) is generation-agnostic by construction -- its `z8-z12` subcommand takes `--elevation`/`--overview`/`--z0-7-fill` as explicit paths, nothing hardcoded to 1.6号's own generation_id. Mechanically it is ready to reuse. But nowhere in `PLAN.md`'s §8 launch-readiness checklist, nor in `HANDOVER.md`'s "What's next" list, was it written down as a step 2号's own launch must actually perform. Left as-is, 2号 would build a fresh `jpnationalsea` coverage from scratch, inherit the exact same Copernicus GLO-30 inventory gap D174 root-caused, and ship with the wall un-fixed -- silently reintroducing a defect this project already spent five D-entries (D174-D178) finding and closing. D174's own "next steps" §4 already anticipated this ("whatever design is chosen should be validated against a real, isolated small-island case... before being trusted at national scale for 2号") but that anticipation was never converted into an actual checklist line. Fixed by adding an explicit item to `PLAN.md` §8: run `build_wall_fix_archive.py`'s z0-7 and z8-z12 modes against 2号's own merged archive, then `pmtiles merge`, then `check_pmtiles_integrity.py`, before 2号's own `stars` publish -- same order D177 used for 1.6号.

**A second, smaller finding, same root cause class**: `LAND_UPSAMPLE_ZOOM_BY_GENERATION` (`hfu-mapterhorn/pipelines/utils.py`) currently has exactly one entry, 1.6号's own generation_id, and its surrounding comment block is written entirely in terms of 1.6号 specifically. D166 finding #3 already established the discipline this table needs (mint the generation_id and add its table entry in the same commit, never after aggregation work has started) but that discipline lives only in a code comment about 1.6号, not as a general checklist item for whichever generation comes next. Added to `PLAN.md` §8 as an explicit reminder to re-apply the same discipline for 2号's own ID.

**Also corrected while reviewing §8**: the publish-script transfer-then-delete reordering that §8 had tracked as an open (⬜) item since 2026-09-06 was actually already implemented and used for real, twice -- D173 (1.6号's own launch) and D178 (this session's wall-fix publish) both used the `.new`-transfer + MD5-verify + atomic-rename procedure the old checklist item was asking for. The checklist itself just never got marked done. A live illustration of `START_HERE.md` §5's own point 6 ("verify before assuming a doc is current") and of `PLAN.md` §8's own prior warning about exactly this failure mode (the 5m/10m corruption-check item that sat stale for three weeks in 2026-09 before being caught the same way).

**No new engineering work done this entry** -- everything above is documentation-only, restoring `PLAN.md` §8 to a state that actually reflects what 2号's launch will need to do. The wall-fix-reapplication step and the upsample-table entry are not yet implemented against any 2号 data, since 2号 itself has not started (still gated on GSI). Revisit `PLAN.md` §8 directly when 2号 actually launches, not this entry -- entries here are not maintained after the fact.

## D180: 【重要・未解決】Hidenoriさんの3D地形目視確認で、1mDEMのある海岸線がほぼ全国で「ゆるく」(輪郭がぼやけ、丸まって)見える問題を発見 -- 根本原因は2つの独立した、それぞれ正当な理由を持つ処理が z16 で組み合わさって生む副作用と特定。恒久修正は未着手、設計判断が必要

**Status**: Open, tracked, real. 実データ(1.6号本番アーカイブ、シリパ岬周辺)で機序を直接検証済み。まだ何もコードは変更していない -- 全国スケールの`aggregation_merge.py`/`aggregation_reproject.py`という核心コードに触れる話であり、Hidenoriさん自身「極めて難易度の高い問題」と認めた通り、実装前に設計判断が要る。

**発端**: Hidenoriさんが3D地形ビューアのスクリーンショット(北海道シリパ岬周辺、「大岩」ラベル付近)を共有。1mメッシュDEM(DEM1A)が存在する海岸線のほぼ全てで、地形が本来あるべき鋭い崖・岩肌ではなく、丸みを帯びた「ゆるい」輪郭になっていると指摘。「オーバーズームマージをしてもらった結果」という表現で発生を説明。

**座標特定**: GSI自身のジオコーディングAPI(`msearch.gsi.go.jp/address-search/AddressSearch`)でシリパ岬の座標を特定(140.772436E, 43.227414N)。対応する1.6号の集約アイテムは`aggregation-store/01M2EAPPYXT8RWNC6TXBRT36JE/12-3649-1501-16-aggregation.csv`(z12マクロタイル、child_z=16)。

### 検証1: D20の`lineage_inspect.py`で実際の勝者ソースを直接確認

このアイテムに5つの優先グループが存在(jpnational1/A、jpnational5/A、jpnational5/B、jpnational10/b、jpnationalsea)。ピクセル数比: `jpnational1`(DEM1A、1m、43.4%)、`jpnationalsea`(GLO-30、56.3%)、残り3グループは合計0.2%程度。生成した provenance PNG(`lineage_inspect.py`は D20 以来、生産パイプラインに未組込の独立診断ツール)を目視すると、DEM1A(青)とjpnationalsea(灰)の境界に沿って、**連続した細い帯**が`jpnational10/b`(橙、global tier 5、最低精度の陸域ティア)で塗られていることを確認 -- DEM5(緑)がこの帯を埋めているのはごく一部(港湾構造物付近)のみで、海岸線の主要部分はDEM10が担っている。

### 検証2: DEM1A自身の海側nodataは本物、正常(バグではない)

このアイテムが参照する47個のDEM1Aソースファイルのうち、海岸に近い20ファイルを直接`rasterio`で読み込みnodata比率を計測。海に大きくかかるメッシュ(例: `FG-GML-6440-65-98`)は95.5%、`FG-GML-6440-66-43`は99.5%がnodata -- **DEM1A(航空レーザ測量)は水面上で反射が得られないため海側は原理的にnodataになる、正当かつ恒久的な特性**であり、GLO-30の壁問題(D174)と同種の「取得元の構造的限界」。ここまでは正常。

### 検証3: なぜその「正常なnodata」の埋め方が問題を生むか -- 2つの独立した仕組みが z16 で重なる

1. **`aggregation_reproject.py`の`create_warp()`(56-58行目)**: 地形(terrarium)エンコードでは`-r cubicspline`を**全グループに無条件で**適用し、しかも全グループを`grouped_source_items[0][0]['maxzoom']`(=最優先グループ、この場合DEM1A自身の実測解像度)に合わせて警告なくワープする(`aggregation_reproject.py`96-137行目のコメント参照、D8由来の設計)。**DEM10(実測z13)がz16へ8倍、jpnationalsea(実測z12)がz16へ16倍、cubicsplineで引き伸ばされる** -- この挙動自体は1号以来の既存設計で、1.6号のD166土地アップサンプリング機能とは独立(このアイテムではDEM1A自身が既にz16なので、D166の`target_zoom > maxzoom`条件は発火していない)。

2. **`aggregation_merge.py`のD114(B)/D116ガウスぼかし境界処理(153-215行目)**: 「どのソースでも永久に埋まらない領域(本物の海岸線)」に隣接する境界で、そのまま`-9999→0`埋めすると1ピクセルで最大100m級の非現実的な垂直崖ができる(D116が実測・修正済みの問題)ため、意図的にガウスぼかしでランプ化する。ぼかし幅(`sigma`)は**固定の実世界150m**(`utils.macrotile_buffer_3857`)から算出される: `overlap = 150m / resolution`, `sigma = overlap/4 - 1`。**このconstant自体はz16に対して初めて設計・検証されたものではなく(D116の合成テストはz16/sigma30で実施され「100m崖→1.43m」への改善を確認・採用された)、原理的には正しい**。しかし、この境界処理は`boundary_tile`が処理中に累積する**全ての**ティア間遷移境界に一律適用される(D114(B)コメント "The boundary_tile accumulated incrementally above, as each group's fill actually happened, is already correct" 参照) -- 「本物の海岸線(未来永劫埋まらない側)」と「DEM10のような、粗いが実在するデータで埋まった側」を区別せず、**同じ150m/sigma30の幅**で扱っている。

**実測したsigma値(z12→z16)**:
```
z12: resolution=19.109m/px, buffer_pixels=7,  sigma=1px  (~19m)
z13: resolution=9.555m/px,  buffer_pixels=15, sigma=2px  (~19m)
z14: resolution=4.777m/px,  buffer_pixels=31, sigma=6px  (~29m)
z15: resolution=2.389m/px,  buffer_pixels=62, sigma=14px (~33m)
z16: resolution=1.194m/px,  buffer_pixels=125,sigma=30px (~36m, 到達距離~143m)
```
1号・1.5号時代に一般的だった、より粗いターゲットズーム(z12前後)では同じ150m定数がわずか1pxのぼかしにしかならず視覚的にほぼ無害だった。DEM1Aが実測でz16に達し(かつD166がさらに他の土地アイテムをz16へ引き上げ)ことで初めて、**同じコード・同じ定数が、1mピクセルの世界では30px(~36m)幅の強いぼかしとして牙を剥いた** -- これが「オーバーズームマージをした結果」の実体だとHidenoriさんが直感的に捉えた現象と一致する。

### まとめ: バグではなく、解像度が変わったことで露呈した設計トレードオフ

D114(B)/D116のガウスぼかしは、当時証明された正当な理由(非現実的な瞬間崖の除去)のために導入され、今も必要 -- 単純に無効化すれば崖問題が復活する。同時に、DEM1A/5が海側でnodataになるのも正常。**問題は、この2つの正しい仕組みの組み合わせが、z16という高解像度で初めて可視化される副作用を持つこと**: 本来DEM1Aが持っていたはずの、海岸線ぎりぎりまでの鋭い岩肌・崖の実測ディテールが、(a) 粗いフォールバック層(DEM10/sea)のcubicspline大幅アップサンプルと、(b) その上に重ねてかかる固定150m幅のガウスぼかし、の二重の平滑化によって、視覚的に「輪郭が丸まった」ように失われている。

**修正の難しさ、Hidenoriさんの認識通り**: DEM1A自体が海側にデータを持たない以上、失われた実測ディテールを「復元」することはできない(D174のGLO-30欠損と同種、恒久的な取得限界)。改善できるとすれば「粗いデータをどう滑らかに見せるか」の調整のみ:
- 候補1: グループの実測maxzoomとターゲットzoomの差が大きい(=大幅アップサンプルが必要な)ケースに限り、`cubicspline`より滑らかさの少ないリサンプリング(`bilinear`や`near`)を使う。
- 候補2: `aggregation_merge.py`のぼかし幅を、固定の実世界メートル数ではなく、「本当に永久に埋まらない境界(D116が対象とした本来のケース)」と「粗いが実在するデータで埋まった境界」を区別して変える -- 後者は現行より狭い幅で十分なはず。
- どちらも1号以来の中核コード(`aggregation_reproject.py`/`aggregation_merge.py`)への変更であり、全国・全世代に影響する。2号を含め将来の全ビルドに波及するため、**D174と同様、実装前に独立設計レビュー(Opus)を経るべき**とHidenoriさんに提案予定。

**この時点でコードは一切変更していない**。次のセッション/ターンでの選択肢: (1) このまま設計検討を継続する、(2) Opusサブエージェントへ設計レビューを委任する、(3) 2号の launch を優先し、この件は別途スコープする(D174が「2号までに解消したい」と明示的にスコープされたのとは異なり、今回はHidenoriさんからまだそのような期限付けの指示は受けていない)。

## D181: プレビューサイトのベースマップを bvmap-starlight へ、MapLibre GL JS を明示バージョン6.11.1へ更新

**Status**: Done、コミット済み。D180のOpus独立設計レビュー(2件、並列でバックグラウンド実行中)とは無関係の、独立したサイト更新作業。Hidenoriさんからの直接指示(「mapterhorn-japan-bridgeのサイトについて次の更新をして欲しい」)。

### 1. ベースマップを `bvmap-starlight` へ

Hidenoriさん自身が別リポジトリ`hfu/stars`で公開しているスタイル(`styles/bvmap-starlight.json`、PR #12「Add styles/bvmap-starlight.json: low-saturation silver-gray bvmap variant」)を採用。`gh api repos/hfu/stars/contents/styles/bvmap-starlight.json`で取得(27,409行、`name`フィールドに"GSI optimized vector tile basemap (bvmap-starlight), background/roads/labels only, no terrain/hillshade"と明記 -- 地形要素は含まない素のベースマップスタイル)。

現行`style.json`から`mapterhorn`(raster-dem)ソースと`hillshade`レイヤーを、bvmap-starlight側の同名レイヤー構成(`background`→`bvmap-行政区画`→`bvmap-水域`→...)の中に**元のスタイルと同じ相対位置**(`bvmap-行政区画`の直後、`bvmap-水域`の前)へ挿入する形でマージ(Pythonスクリプトで機械的に実施、手編集ではない)。glyphs/sprite/bvmapソース定義はbvmap-starlight自身のもの(`https://stars.optgeo.org/font/...`、`https://stars.optgeo.org/sprite/bvmap-starlight`、TileJSON経由の`bvmap`ソース)をそのまま採用 -- 旧`style.json`の`gsi-cyberjapan.github.io`直参照よりstars自身がホストする経路に統一される。

### 2. MapLibre GL JS を6.11.1へ明示ピン留め

D175時点では`@6`という浮動タグ(unpkgが要求時点の最新6.x系を返す)のままだった。npm registryで最新版(6.11.1、2026-09-24時点)を確認し、`index.html`のCSS `<link>`と`app.js`のESM importを両方とも`@6.11.1`へ明示的に固定 -- 将来の6.x系リリースがこのページの挙動を無断で変えないようにする、というこのプロジェクト自身のバージョン固定規律に合わせた。unpkg経由で両ファイルとも200で取得可能なことを確認済み。

### 検証

このセッションはブラウザ接続(`claude-in-chrome`)なし。代わりに`python3 -m http.server`でリポジトリをローカル配信し、`playwright`(システムの Google Chrome.app をexecutablePathで直接指定、ローカルにChromiumバイナリを別途インストールする必要なし)でヘッドレスレンダリングし、実際のスクリーンショットで確認:
- bvmap-starlightのグレースケール配色が正しく表示され、hillshade/3D地形(風不死岳、支笏湖畔)が正しく重なって表示されることを確認(スクリーンショット取得、Hidenoriさんへ送付済み)。
- コンソールエラーは`/favicon.ico`の404のみ(このサイトはそもそもfaviconを持ったことがない、今回の変更と無関係の既存の欠落 -- スコープ外につき対応せず)。
- ネットワーク到達性を個別に確認: `stars.optgeo.org/sprite/bvmap-starlight.{json,png}`(200)、`stars.optgeo.org/font/{fontstack}/{range}`(実際に使われているフォントスタック名`Noto Sans JP Regular`/`Noto Serif JP SemiBold`で200確認、当初の推測フォント名では404だったため要修正)、`stars.optgeo.org/bvmap`・`stars.optgeo.org/mapterhorn-japan-bridge`のTileJSON(いずれも200、正しいtiles URL/attributionを含む)。

### 現在の状態

`index.html`・`app.js`・`style.json`をコミット・push予定。GitHub Pagesへの反映は次のGitHub Actionsビルド(pushで自動トリガー)を待つのみ。cafebabeさんへ依頼していたD175の目視確認は依然未回答だが、これは別件として引き続き追跡する(HANDOVER.md「What's next」参照)。

## D182: 竹島付近でz13+の「壁」を実証 -- D177が明示的に先送りしていた「z13+深部で同じ問題が実際に出るか」という問いに、初めて実機確認で答えが出た。D174と同じGLO-30欠損、既にz8-z12は正常に修復済み

**Status**: Confirmed via live reproduction, real data. コード変更はまだ行っていない -- D174の staged fix(z8-z12)がそもそも意図的にz13+を対象外としていたことの直接的な帰結であり、新しいバグではない。

**発端**: Hidenoriさんが公開サイト(D181で`bvmap-starlight`へ更新した直後のもの)を実際に操作中、竹島近辺で壁アーティファクトを目視。具体的なURL(`https://hfu.github.io/mapterhorn-japan-bridge/#hash=9.59/37.3953/132.1873/41.4/45`)とスクリーンショットを共有。

### 再現・特定の手順(実データ・実サイトで検証、推測なし)

1. **ヘッドレスChromeで実URLをそのまま再現**: `playwright`(システムのGoogle Chrome.appを直接指定)で公開サイトのハッシュURLを開き、Hidenoriさんの報告と同一の壁(垂直な壁面+白い水平帯)をスクリーンショットで確認。
2. **`map.unproject()`+`map.queryTerrainElevation()`で壁の実座標・標高を直接取得**: 壁の付け根(暗い割れ目)に対応する画面ピクセルをunprojectしたところ、lng=132.18039, lat=37.43975。その地点の`queryTerrainElevation()`が**-19732.4m**という物理的にあり得ない値を返した -- D113-D118/D174で特定済みの「欠損(204)タイルがMapLibreにより極端な負の標高として解釈される」機序と同一の症状(厳密に-32768ではなくブレンドされた中間値になっているのは、この関数が近傍テクセル間を補間するため)。
3. **z8-z16の実タイルHTTPステータスを直接確認**: 同じ座標で計算したタイル位置(z8=`221/99`〜z12=`3551/1588`)は**全て200**、かつ`terrarium_decode()`で標高0.0mのフラットな値(=D174のz8-z12合成フィルが正しく機能している証拠)。しかし**z13(`7103/3176`)以降は、その4近傍を含め全て204**。z8-z12は無罪、z13+が実際に壁の直接原因と特定。
4. **GLO-30本家インベントリで裏付け**: `hfu-mapterhorn/source-catalog/glo30/file_list.txt`(24,674セルの全球スナップショット)に`N37_00_E132_00`・`N38_00_E132_00`のいずれも存在しない(西隣の`N37_00_E131_00`は存在)。D174が既に確立した「Copernicus GLO-30本家インベントリの本物の欠損」という機序と完全に同一 -- 竹島およびその北側の海域がちょうどこの2つの欠損セルにまたがっている。

### 位置づけ: 新しいバグではなく、D177が明示的に開けたままにしていた問いへの答え

`HANDOVER.md`の「What's next」#2(旧#2、D179再整理後の#3)は「z13+深部で同じ壁が実際に出るか、このセッションはブラウザが無く未確認だった」と明記し、「(a) 別セッションまたはHidenoriさんによる実機確認、があれば再訪する」としていた。**今回がまさにその(a)**。答えは明確に **Yes、実際に出る、しかも竹島という注目度の高い(領土問題で頻繁に閲覧される)地点で** -- z8-z12だけでは不十分だったことが実証された。

### 次の一手(未着手、Hidenoriさんの判断待ち)

D174の第一設計レビューが当初「z13-z16まで埋めると海全体で約8,600万タイル」という理由でz8-z12へスコープを縮小した経緯がある(DECISIONS1.md D174参照)。z13+へ拡張する場合、`build_wall_fix_archive.py`は現在`z0-7`/`z8-z12`の2モードのみ実装済みで、第三のモード(またはズーム範囲パラメータ化)が必要 -- 実装前に、当時見送られた8,600万タイル規模のコスト計算を、現在の`stars`空き容量(D159で1.6TBへ拡張済み)を踏まえて再検証する必要がある。今回のD180(海岸線ゆるさ問題)のOpus独立レビューとは完全に別件・並行して扱ってよい。

## D180追記1: 独立Opusレビュー(A)完了 -- D180の見立てを大きく訂正。「見た目の問題」ではなく「実測1mデータの改ざん」、原因はほぼ全てガウスぼかし単独、修正案は既にD116非退行を実証済み

**Status**: レビューA(worktree分離、読み取り専用、実データで実行、171,869トークン・81ツール呼び出し・約21分)完了。レビューB(独立・並行)は引き続き実行中、未完了。以下はレビューAの単独の結論であり、まだ「Opusレビューの合意」ではない -- レビューBの結果と突き合わせるまでは暫定。

### D180の4つの実証的主張は全て再現・確認 -- しかし「重み付け」が誤っていたと判明

レビューAは`source-store/jpnational1/`の47ファイル全てを独自に読み込み、nodata比率(95.5%/99.5%含め完全一致)、`create_warp()`の無条件`-r cubicspline`動作、sigma計算表(z12:1px〜z16:30px)を全て独立に再現した。**その上で、D180が「2つの独立した要因」として並記した(1)cubicsplineオーバーズームと(2)ガウスぼかしの重みづけが誤りだったと指摘**: 実際に大幅アップサンプル(8倍・16倍)されるグループをcubicsplineからbilinearへ差し替えて実測したところ、平均差はわずか0.4〜0.6m(最大12〜14m)。一方ガウスぼかしを止めると平均7〜9m・最大102mの差が出る。**候補1(リサンプリング手法の変更)は却下すべき、ぼかし単独が原因のほぼ100%**。

### 「見た目がゆるい」ではなく「実測データの改ざん」という重大な再定義

シリパ岬の1アイテムだけで、**実測DEM1A陸地ピクセルのうち238,479px(0.77%)が10m超変化、最大誤差102.02m**。具体例(実データ): 幅140m・高さ41.19mの岩(おそらく「大岩」そのもの)の頂上標高が、現行パイプラインでは**2.90m**にまで潰れて出力される。幅37mの岩(高さ48.39m)は**14.64m**。これは「見た目が甘い」ではなく「測量された実データが誤ったデータで上書きされている」という正確性の問題だと再定義された。

### 原因のさらなる特定: D166がこの問題を全国の1/3で5〜15倍悪化させた

1.6号の全6,373アイテムを分類した結果、**陸域アイテム4,133件全て(うち4,131件が複数ソース)が現在sigma=30pxでぼかされている**。うち2,126件は本来(D166のアップサンプリングが無ければ)sigma=2px/6pxで済んでいたはずのアイテム -- **D166の土地アップサンプリング機能が、全国の陸域アイテムの約1/3で、この問題を意図せず5〜15倍悪化させていた**、という新発見。1.6号は1号・1.5号より海岸が悪化している。

### 提案された修正: D114(B)が削除したerosionを「ゲート」としてでなく「分類器」として復活させる

`boundary_tile`を2種類に分割:
- **void(空白)級境界**: 隣接ピクセルがどのソースにも永久に埋まらない(D116の本来の対象) -- 現行のsigma=30を**維持**。
- **seam(継ぎ目)級境界**: 隣接ピクセルは粗いが実在するソースで埋まっている(海岸線の主要ケース) -- sigmaを**小さい固定px数(推奨6px)に上限設定**。

分類は`never_covered_mask`のerosion(D114(B)が「ゲートとして使うと必ず境界が消える」という理由で削除したのと同じ計算)を**削除ではなく分類に転用**することで実現 -- 「D114(B)のバグを再発させない」構造的な保証になっている。`aggregation_reproject.py`・`macrotile_buffer_3857`・warp範囲・ラスタ寸法は一切変更不要(D166の`leaf_child_z()`アサートにも影響なし)。

### 検証済みの効果(実データ、シリパ岬)

| | 現行 | 提案(cap6) |
|---|---|---|
| seam最大段差 | 2.01m | 5.59m |
| seam段差>5m率 | 0.000% | **0.074%**(自然な1m地形そのものの0.066%とほぼ同水準) |
| DEM1A実測ディテール保持率 | 42.8% | **86.8%** |
| 陸地px改ざん>1m | 701,106 | 88,011 |
| 陸地px改ざん>10m | 238,479 | 10,456 |

**D116の合成テスト(762×762、maxzoom16、sigma30、void境界のみ)を再実行した結果、現行コードと提案コードは完全にbit-identical**(残留-9999数・最大隣接段差とも完全一致) -- D116の崖バグ修正は一切退行しない。**副次効果として処理速度も4.3倍高速化**(void判定に該当しない窓ではsigma=30の高コストなgaussian_filterを2回丸ごとスキップできるため)。

### 自己批判的リスクチェックで見つかった限界(正直な報告)

- 小島は劇的に改善(合成: 幅41m/高さ25mの島が現行1.28m→修正後24.28m)するが、**200px未満のごく小さいパッチの一部は逆に悪化する**ケースも実測で見つかった(D1A自体のデータが疎らな極小パッチではノイズレベルの比較になるため、大きなパッチほど改善は明確)。
- 防波堤(合成12m幅)は現行0.72m(消滅)→修正後3.28mへ改善するが、**完全には復元しない**(cap6ではまだ幅が足りない、cap4ならより良いがz14アイテムにも影響が及ぶ)。
- **この問題は海岸線に限らない**: シリパ岬の1アイテムだけで、内陸のDEM1A欠損(レーザーの死角となる急崖など)86,433pxが同じ143mハロー被害を受けていることを発見 -- 海岸線だけの問題ではなく、内陸の崖・渓谷でも同様の改ざんが起きている。
- **最大の運用リスク**: `.done`マニフェストのフィンガープリントは入力(ソースファイルMD5)のみを対象とし、コード変更を検知しない -- `aggregation_merge.py`を直しても既に公開済みの1.6号の6,373アイテムは自動的に再生成されない。**レビューAの推奨: 1.6号への現地修正(in-place patch)ではなく、2号を新しいgeneration_idとして開始する形でこの修正を導入すべき**(1.6号を直す場合は陸域4,131アイテム全てとその上流downsamplingの全国再構築が必要になり、事実上の全国再構築と同義になる -- これはHidenoriさんの「全国作り直しをしてもいい」という発言と整合する)。

### 未検証・要フォローアップ(レビューA自身が明記)

- T4(z14以下での完全bit-identical実証、実データ)・T6(本物のnever-covered領域を含む実アイテムでのvoid級境界の実データ検証、シリパ岬は偶然jpnationalseaが全域を覆っており該当ケースが無かった)・T8(タイル化・downsamplingまでのエンドツーエンド差分)は未実行。特にT6(本物のvoid境界での実データ検証)は「最も重要な残課題」とレビューA自身が明記。
- cap値(4 or 6)は視覚判断が必要な段階が残っており、レビューAは「Hidenoriさんの目視確認で決めるべき」としている。
- 全国規模への外挿は「1アイテムからの桁感」であり実測ではない。

### 次

レビューB(独立・並行)の結果待ち。両者を突き合わせてから、T4/T6/T8の残課題実行、cap値の視覚比較、および1.6号 in-place vs 2号新規generationのどちらを取るかの判断へ進む。

## D183: 「1.7号」を新規発番決定 -- D180(海岸線ぼかし修正)とD182(z13+壁拡張)をまとめる、2号とは別のgeneration。2号はGSIデータ更新専用として温存

**Status**: Decision recorded, 2026-09-24。Hidenoriさんの直接指示: 「z13+拡張にも着手するよ。2号はデータ更新を反映したときに使いたいので、必要であれば、1.7号という新しい名前にしてくれればいい」。

**背景**: レビューA(D180追記1)が「1.6号への現地修正ではなく新しいgenerationとして導入すべき」と推奨していたところに、Hidenoriさんから「D182のz13+壁拡張にも同時に着手してよい、ただし2号という名前はGSIの実データ更新まで温存したい」という指示が来た。1.5号→1.6号の前例(いずれも「同じソースデータ、パイプラインだけ変える」世代)と全く同じパターンなので、1.6号の次の「同ソースデータ・パイプライン修正世代」を素直に1.7号と呼ぶことにした。

**スコープ、この時点の計画(両方ともまだ未完了)**:
1. D180: ガウスぼかしのseam/void分類修正(レビューA完了・レビューB進行中、T4/T6/T8が未検証)
2. D182: z13+壁拡張(竹島近辺での実証は完了、コスト再計算・実装はこれから)

**`PLAN.md`§0に行を追加**(ULIDはまだ発番していない -- D166 finding #3の規律により、実際にどちらかの修正が本番投入可能になった時点で、`utils.py`のテーブルエントリ追加と同一コミットで発番する)。2号の行も、1.7号を経由してから起動する旨に更新。

**次**: z13+拡張(D182)のコスト再計算に着手(D174が当初「z13-z16まで埋めると海全体で約8,600万タイル」という理由でスコープを縮小した根拠を、現在のstars空き容量(1.6TB)を踏まえて再検証)。D180はレビューB完了待ち、並行して進める。

