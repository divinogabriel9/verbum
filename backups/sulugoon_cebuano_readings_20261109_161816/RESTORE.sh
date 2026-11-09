#!/usr/bin/env bash
set -e; cd "$(git rev-parse --show-toplevel)"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/mass_language.py" "services/mass_language.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/lectionary_service.py" "services/lectionary_service.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/awit_at_papuri_readings.py" "services/awit_at_papuri_readings.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/calendar_month.py" "services/calendar_month.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/readings_snapshot.py" "services/readings_snapshot.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/services/superadmin/readings_admin.py" "services/superadmin/readings_admin.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/pipeline.py" "pipeline.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/static/js/app/app-01-core.js" "static/js/app/app-01-core.js"
cp "backups/sulugoon_cebuano_readings_20261109_161816/static/js/app/app-07-posters-slideshow.js" "static/js/app/app-07-posters-slideshow.js"
cp "backups/sulugoon_cebuano_readings_20261109_161816/static/js/mw-wizard.js" "static/js/mw-wizard.js"
cp "backups/sulugoon_cebuano_readings_20261109_161816/tests/test_awit_at_papuri_readings.py" "tests/test_awit_at_papuri_readings.py"
cp "backups/sulugoon_cebuano_readings_20261109_161816/tests/test_mass_language_cebuano.py" "tests/test_mass_language_cebuano.py"
rm -f services/sulugoon_readings.py tests/test_sulugoon_readings.py
echo Restored from backups/sulugoon_cebuano_readings_20261109_161816
