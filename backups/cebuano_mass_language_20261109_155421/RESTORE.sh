#!/usr/bin/env bash
# Restore files to their pre-Cebuano state. Run from repo root:  bash backups/cebuano_mass_language_20261109_155421/RESTORE.sh
set -e
cd "$(git rev-parse --show-toplevel)"
cp "backups/cebuano_mass_language_20261109_155421/services/mass_language.py" "services/mass_language.py"
cp "backups/cebuano_mass_language_20261109_155421/services/prayer_service.py" "services/prayer_service.py"
cp "backups/cebuano_mass_language_20261109_155421/services/mass_habits.py" "services/mass_habits.py"
cp "backups/cebuano_mass_language_20261109_155421/services/demo_access.py" "services/demo_access.py"
cp "backups/cebuano_mass_language_20261109_155421/services/lectionary_service.py" "services/lectionary_service.py"
cp "backups/cebuano_mass_language_20261109_155421/generators/powerpoint.py" "generators/powerpoint.py"
cp "backups/cebuano_mass_language_20261109_155421/generators/leaflet.py" "generators/leaflet.py"
cp "backups/cebuano_mass_language_20261109_155421/generators/gfcc_flow_content_tagalog.py" "generators/gfcc_flow_content_tagalog.py"
cp "backups/cebuano_mass_language_20261109_155421/server.py" "server.py"
cp "backups/cebuano_mass_language_20261109_155421/templates/index.html" "templates/index.html"
cp "backups/cebuano_mass_language_20261109_155421/static/js/app.js" "static/js/app.js"
cp "backups/cebuano_mass_language_20261109_155421/static/js/app/app-01-core.js" "static/js/app/app-01-core.js"
cp "backups/cebuano_mass_language_20261109_155421/static/js/app/app-07-posters-slideshow.js" "static/js/app/app-07-posters-slideshow.js"
cp "backups/cebuano_mass_language_20261109_155421/static/js/app/app-08-calendar-catalog.js" "static/js/app/app-08-calendar-catalog.js"
cp "backups/cebuano_mass_language_20261109_155421/tests/test_mass_language_tagalog.py" "tests/test_mass_language_tagalog.py"
cp "backups/cebuano_mass_language_20261109_155421/REDESIGN_INTEGRATION_CONTRACT.md" "REDESIGN_INTEGRATION_CONTRACT.md"
cp "backups/cebuano_mass_language_20261109_155421/static/js/mw-wizard.js" "static/js/mw-wizard.js"
cp "backups/cebuano_mass_language_20261109_155421/pipeline.py" "pipeline.py"
cp "backups/cebuano_mass_language_20261109_155421/static/js/lazy-assets.js" "static/js/lazy-assets.js"
rm -f generators/gfcc_flow_content_cebuano.py tests/test_mass_language_cebuano.py
echo 'Restored pre-Cebuano state from backups/cebuano_mass_language_20261109_155421'
