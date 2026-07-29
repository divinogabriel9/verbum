"""Awit at Papuri Tagalog readings scraper tests (offline parse)."""

from __future__ import annotations

from services.awit_at_papuri_readings import parse_awit_html

SAMPLE = """
<html><body><div class="entry-content">
<p>Podcast: Download</p>
<p>Martes ng Ika-17 Linggo sa Karaniwang Panahon (II)</p>
<p><strong>Tuesday of the Seventeenth Week in Ordinary Time</strong> <em>(Green)</em></p>
<p><strong>UNANG PAGBASA</strong><br />Jeremias 14, 17-22</p>
<p>Pagbasa mula sa aklat ni propeta Jeremias</p>
<p>“Unang talata ng pagbasa dito para sa pagsusulit.”</p>
<p>Ang Salita ng Diyos.</p>
<p><strong>SALMONG TUGUNAN</strong><br />Salmo 78, 8. 9. 11 at 13</p>
<p>Dahil sa ngalan mo, Poon, iligtas mo kami ngayon.</p>
<p>Unang berso ng salmo dito.</p>
<p>Dahil sa ngalan mo, Poon, iligtas mo kami ngayon.</p>
<p><strong>ALELUYA</strong></p>
<p>Aleluya! Aleluya! Salita ng D’yos ang buto. Aleluya! Aleluya!</p>
<p><strong>MABUTING BALITA</strong><br />Mateo 13, 36-43</p>
<p>Ang Mabuting Balita ng Panginoon ayon kay San Mateo</p>
<p>Noong panahong iyon, nagsalita si Hesus sa bayan nang mahaba.</p>
<p>Ang Mabuting Balita ng Panginoon.</p>
<p><strong>PANALANGIN NG BAYAN</strong></p>
</div></body></html>
"""


def test_parse_awit_html_blocks():
    entry = parse_awit_html(SAMPLE, source_url="https://example.test/day")
    assert "Martes ng Ika-17" in entry["mass_celebration"]
    assert entry["first_reading_ref"] == "Jeremias 14, 17-22"
    assert "Unang talata" in entry["first_reading"]
    assert entry["psalm_ref"].startswith("Salmo 78")
    assert "Dahil sa ngalan mo" in entry["psalm_response"]
    assert "Aleluya! Aleluya!" in entry["gospel_acclamation"]
    assert entry["gospel_ref"] == "Mateo 13, 36-43"
    assert "Noong panahong iyon" in entry["gospel"]
    assert entry["source_url"].endswith("/day")
