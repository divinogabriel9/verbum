"""
Cebuano (Bisaya) GFCC mass flow text — Misa Bisaya Ordo as projected in
Cebu / Visayas–Mindanao parishes.
Markers: <<P>> priest, <<A>> all/congregation,
<<D>> direction (italic gold), <<H>> hymn body (white). <<BR>> line break only.

Variable parts (Collect, Preface body, Eucharistic Prayer Proper) remain in the
Missal for the day — same pattern as the English / Tagalog flow modules.
Scripture readings stay in English (no stable daily Cebuano lectionary feed).
"""

# --- Pre-Mass & entrance ---
SILENT_REMINDER = """<<H>>PALIHUG I-SILENT MODE ANG INYONG CELLPHONE SAMTANG NAGMISA.
Daghang salamat."""

ENTRANCE_HYMN_1 = """<<D>>Ang liriko sa awit sa pagsulod gikan sa librarya sa mga himno."""

ENTRANCE_HYMN_2 = """<<D>>Pagpili og usa ka awit sa pagsulod sa Mass Flow o itala ang liriko sa Lyrics Studio."""

# --- Introductory rites ---
SIGN_CROSS = """<<P>>Sa ngalan sa Amahan, ug sa Anak, ug sa Espiritu Santo.
<<A>>Amen.
<<P>>Ang Ginoo maanaa kaninyo.
<<A>>Ug maanaa usab kanimo."""

GREETING_EXTENDED = """<<P>>Mga igsoon, atong ilhon ang atong mga sala aron kita mahimong takus sa pagsaulog niining balaang misteryo."""

CONFITEOR_OPEN = """<<A>>Nagakumpisal ako sa Dios nga makagagahum sa tanan ug kaninyo, mga igsoon, nga nakasala ako sa hilabihan gayud sa hunahuna, sa pulong, sa buhat, ug sa wala pagbuhat sa angay buhaton; busa nagahangyo ako kang Santa Maria nga Birhen kanunay, sa tanang mga anghel ug mga santos, ug kaninyo, mga igsoon, nga iampo ninyo ako sa Ginoo nga atong Dios."""

ABSOLUTION_PENITENTIAL = """<<P>>Kaloy-an unta kita sa Dios nga makagagahum sa tanan, pasayloon ang atong mga sala, ug dad-on kita ngadto sa kinabuhing dayon.
<<A>>Amen."""

KYRIE = """<<A>>Ginoo, kaloy-i kami.
<<A>>Ginoo, kaloy-i kami.
<<A>>Kristo, kaloy-i kami.
<<A>>Kristo, kaloy-i kami.
<<A>>Ginoo, kaloy-i kami.
<<A>>Ginoo, kaloy-i kami."""

GLORIA_FULL = """<<H>>Himaya sa Dios sa kahitas-an
ug sa yuta kalinaw sa mga tawo nga iyang gikahimut-an.
Nagadayeg kami kanimo,
nagahimaya kami kanimo,
nagasimba kami kanimo,
nagapasidungog kami kanimo,
nagapasalamat kami kanimo tungod sa imong dakung himaya.
Ginoong Dios, Hari sa langit, Dios Amahan nga makagagahum sa tanan.
<<H>>Ginoong Jesukristo, Bugtong nga Anak,
Ginoong Dios, Kordero sa Dios, Anak sa Amahan,
ikaw nga nagawagtang sa mga sala sa kalibutan, kaloy-i kami;
ikaw nga nagawagtang sa mga sala sa kalibutan, dawata ang among pangamuyo;
ikaw nga nagalingkod sa tuo sa Amahan, kaloy-i kami.
<<H>>Kay ikaw lamang ang Santos,
ikaw lamang ang Ginoo,
ikaw lamang, O Jesukristo, ang Labing Halangdon,
uban sa Espiritu Santo diha sa himaya sa Dios Amahan.
Amen."""

OPENING_PRAYER = """<<P>>Mag-ampo kita.
<<A>>Amen."""

# --- Liturgy of the Word ---

LITURGY_WORD_TITLE = """<<H>>LITURHIYA SA PULONG SA DIOS
<<D>>Titulo sa bahin — mahimong ipaila sa komentarista ang Liturhiya sa Pulong sa Dios."""

ALLELUIA_SING = """<<H>>ALELUYA! ALELUYA! ALELUYA! ALELUYA!
<<D>>Awita ang bersikulo sa Aleluya sumala sa Leksyonaryo alang niining Misa nga tibuok, ayaw pamub-a."""

ALLELUIA_COMMENTATOR = """<<D>>Kon ipahibalo sa komentarista ang bersikulo sa dili pa ang Aleluya, isulti nga tibuok ang bersikulo gikan sa Leksyonaryo, unya awiton sa katawhan ang Aleluya ug ang tubag nga wala pamub-a."""

GOSPEL_INTRO = """<<P>>Ang Ginoo maanaa kaninyo.
<<A>>Ug maanaa usab kanimo.
<<P>>Ang pagbasa gikan sa Santos nga Ebanghelyo sumala ni {gospel_book}.
<<A>>Himaya kanimo, O Ginoo."""

GOSPEL_END = """<<P>>Ang Ebanghelyo sa Ginoo.
<<A>>Daygon ikaw, O Kristo."""

# --- Creed & Prayer of the Faithful ---
CREED_1 = """<<A>>Nagatoo ako sa Dios Amahan nga makagagahum sa tanan,
Magbubuhat sa langit ug sa yuta.
Nagatoo ako kang Jesukristo, iyang bugtong Anak, atong Ginoo,
nga gipanamkon sa lalang sa Espiritu Santo,
gianak ni Maria nga Birhen."""

CREED_2 = """<<A>>Nag-antos siya sa sugo ni Poncio Pilato,
gilansang sa krus, namatay ug gilubong.
Mikanaug siya sa mga minatay,
sa ikatulo ka adlaw nabanhaw siya.
Misaka siya sa langit
ug nagalingkod sa tuo sa Dios Amahan nga makagagahum sa tanan.
Gikan didto mobalik siya aron paghukom sa mga buhi ug sa mga minatay."""

CREED_3 = """<<A>>Nagatoo ako sa Espiritu Santo,
sa santos nga Simbahang Katoliko,
sa panag-ambit sa mga santos,
sa kapasayloan sa mga sala,
sa pagkabanhaw sa lawas,
ug sa kinabuhing dayon.
Amen."""

PRAYER_FAITHFUL_1 = """<<D>>Ang Pag-ampo sa Katawhan gipangulohan nga tibuok ang matag pangamuyo, ug tibuok ang tubag sa katawhan.
<<P>>Alang sa santos nga Simbahan sa Dios sa tibuok kalibutan, nga bantayan unta siya sa Ginoo ug hatagan og kalinaw ug panaghiusa sumala sa iyang kabubut-on: mag-ampo kita sa Ginoo.
<<A>>Ginoo, pamatia ang among pag-ampo."""

PRAYER_FAITHFUL_2 = """<<P>>Gitapos sa Pari ang Pag-ampo sa Katawhan pinaagi sa usa ka tibuok nga pag-ampo, pananglitan:
<<P>>Amahan nga anaa sa langit, pamatia ang mga pag-ampo sa imong Simbahan, nga among gihalad pinaagi ni Kristo nga among Ginoo.
<<A>>Amen."""

# --- Liturgy of the Eucharist ---
OFFERTORY_HYMN = """<<D>>Ang liriko sa awit sa paghalad gikan sa librarya sa mga himno."""

LOE_TITLE = """<<H>>LITURHIYA SA EUKARISTIYA"""

PRAY_BRETHREN = """<<P>>Pag-ampo kamo, mga igsoon, aron ang akong halad ug ang inyong halad dawaton sa Dios Amahan nga makagagahum sa tanan.
<<A>>Dawaton unta sa Ginoo kining halad gikan sa imong mga kamot, alang sa pagdayeg ug paghimaya sa iyang ngalan, alang sa atong kaayohan ug sa tibuok niyang Simbahan nga santos."""

PREFACE_DIALOGUE = """<<P>>Ang Ginoo maanaa kaninyo.
<<A>>Ug maanaa usab kanimo.
<<P>>Ibayaw ang inyong mga kasingkasing.
<<A>>Gibayaw na namo ngadto sa Ginoo.
<<P>>Magpasalamat kita sa Ginoo nga atong Dios.
<<A>>Angay ug matarung."""

PREFACE_ACCLAIM = """<<D>>Ipadayon sa Pari ang Prepasyo sa adlaw gikan sa Misal — ang tibuok Prepasyo alang niining Misa — hangtod nga moduyog ang katawhan sa pag-awit o pagsulti sa Santos, Santos (Sanctus)."""

SANCTUS = """<<H>>Santos, Santos, Santos
nga Ginoo, Dios sa kagahuman!
Puno ang langit ug ang yuta sa imong himaya!
Osana sa kahitas-an!
Dalaygon ang nagaanhi sa ngalan sa Ginoo!
Osana sa kahitas-an!"""

MYSTERY_FAITH = """<<D>>Awiton o isulti sa Pari ang pasiuna sa Misteryo sa Pagtoo, unya awiton o isulti sa katawhan ang usa sa mga Memorial Acclamation nga tibuok:
<<H>>Ginoo, gimantala namo ang imong kamatayon ug gipadayag ang imong pagkabanhaw hangtod sa imong pagbalik.
<<D>>o
<<H>>Sa matag higayon nga mokaon kami niining Pan ug moinom niining Kalis, gimantala namo ang imong kamatayon, O Ginoo, hangtod sa imong pagbalik.
<<D>>o
<<H>>Luwasa kami, Manluluwas sa kalibutan, kay pinaagi sa imong Krus ug Pagkabanhaw gipalingkawas mo kami."""

GREAT_AMEN = """<<A>>Amen.
<<D>>Motubag ang katawhan og “Amen” sa doksolohiya sa katapusan sa Pag-ampo sa Eukaristiya."""

OUR_FATHER_ENGLISH = """<<H>>Amahan namo nga anaa sa mga langit,
pagdaygon ang imong ngalan.
Umabot kanamo ang imong gingharian.
Matuman ang imong pagbuot,
dinhi sa yuta maingon sa langit.
Ang kalan-on namo sa matag adlaw, ihatag kanamo karong adlawa.
Ug pasayloa kami sa among mga sala,
ingon nga nagapasaylo kami sa mga nakasala kanamo.
Ug dili mo kami itugyan sa mga panulay,
hinonoa luwasa kami sa dautan.

<<D>>Teksto sa Amahan Namo sumala sa Misa Bisaya (Ordo sa Misa), tibuok isulti o awiton."""

COMMUNION_RITE_DELIVER = """<<P>>Luwasa kami, Ginoo, gikan sa tanang dautan, ug ihatag kanamo ang kalinaw niining among panahon, aron pinaagi sa tabang sa imong kalooy mahilikay kami kanunay sa sala ug sa tanang kasamok, samtang nagapaabot kami sa bulahang paglaum ug sa pag-abot sa among Manluluwas nga si Jesukristo.
<<A>>Kay imo ang gingharian, ug ang gahum, ug ang himaya hangtod sa kahangturan! Amen."""

SIGN_PEACE = """<<P>>Ang kalinaw sa Ginoo maanaa kaninyo kanunay.
<<A>>Ug maanaa usab kanimo.
<<D>>Maghatagay kita sa timaan sa kalinaw."""

LAMB_OF_GOD = """<<H>>Kordero sa Dios,
nga nagawagtang sa mga sala sa kalibutan,
kaloy-i kami.
Kordero sa Dios,
nga nagawagtang sa mga sala sa kalibutan,
kaloy-i kami.
Kordero sa Dios,
nga nagawagtang sa mga sala sa kalibutan,
ihatag kanamo ang kalinaw."""

COMMUNION_DIALOGUE = """<<P>>Tan-awa ang Kordero sa Dios, tan-awa siya nga nagawagtang sa mga sala sa kalibutan. Bulahan ang mga gidapit sa panihapon sa Kordero.
<<A>>Ginoo, dili ako takus nga mosulod ka sa akong puloy-anan, apan isulti lamang ang usa ka pulong ug mamaayo ako."""

COMMUNION_HYMN = """<<D>>Ang liriko sa awit sa pagkalawat gikan sa librarya sa mga himno."""

POST_COMMUNION = """<<P>>Mag-ampo kita.
<<D>>Isulti sa Pari ang Pag-ampo human sa Pagkalawat alang sa adlaw nga tibuok gikan sa Misal. Motubag ang katawhan sa katapusan.
<<A>>Amen."""

# --- Announcements & closing ---
ANNOUNCEMENTS_TITLE = """<<H>>MGA PAHIBALO SA SIMBAHAN
<<D>>Ibutang ang tibuok nga mga pahibalo sa mosunod nga mga slide o usba kining deck."""

WELCOME_NEWCOMERS = """<<H>>Maayong pag-abot sa mga bisita!
<<D>>Opsyonal ang photo collage."""

CONFESSION_SLIDE = """<<H>>Sakramento sa Pagkumpisal
<<D>>Dili gayud kapoyon ang Ginoo sa pagpasaylo; kita ang kapoyon sa pagpangita sa iyang kalooy. — Papa Francisco"""

COLLECTION_PLACEHOLDER = """<<H>>Koleksyon sa Misa
<<D>>Isulti nga tibuok ang katuyoan ug ang petsa."""

SPONSORSHIP = """<<H>>Pag-isponsor sa Pagkaon o Misa
<<D>>Ihatag ang tibuok kontak sa koordinador sa parokya."""

FB_UPDATES = """<<H>>Mga Update ug Pahibalo
<<D>>Nganli ang page sa komunidad ug ang imbitasyon sa pag-follow; idugang ang QR code kon gusto."""

FINAL_BLESSING = """<<P>>Ang Ginoo maanaa kaninyo.
<<A>>Ug maanaa usab kanimo.
<<P>>Panalanginan unta kamo sa Dios nga makagagahum sa tanan, ang Amahan, ug ang Anak, ug ang Espiritu Santo.
<<A>>Amen.
<<P>>Human na ang Misa. Lakaw kamo sa kalinaw ug ipakaylap ang Maayong Balita sa inyong kinabuhi.
<<A>>Salamat sa Dios."""

RECESSIONAL_1 = """<<D>>Ang liriko sa awit sa paggula gikan sa librarya sa mga himno."""

RECESSIONAL_2 = """<<D>>Pagpili og usa ka awit sa paggula sa Mass Flow o itala ang liriko sa Lyrics Studio."""
