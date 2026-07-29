"""
Tagalog GFCC mass flow text (Filipino Ordo / Sambuhay-style).
Markers: <<P>> priest, <<A>> all/congregation,
<<D>> direction (italic gold), <<H>> hymn body (white). <<BR>> line break only.

Variable parts (Collect, Preface body, Eucharistic Prayer Proper) remain in the
Missal for the day — same pattern as the English flow module.
"""

# --- Pre-Mass & entrance ---
SILENT_REMINDER = """<<H>>ILAGAY SA SILENT MODE ANG IYONG CELLPHONE HABANG NAGMIMISA.
Salamat."""

ENTRANCE_HYMN_1 = """<<D>>Ang liriko ng pambungad na awit ay mula sa aklatan ng mga himno."""

ENTRANCE_HYMN_2 = """<<D>>Pumili ng isang pambungad na awit sa Mass Flow o magtala ng liriko sa Lyrics Studio."""

# --- Introductory rites ---
SIGN_CROSS = """<<P>>Sa ngalan ng Ama, at ng Anak, at ng Espiritu Santo.
<<A>>Amen.
<<P>>Sumainyo ang Panginoon.
<<A>>At sumaiyo rin."""

GREETING_EXTENDED = """<<P>>Mga kapatid, aminin natin ang ating mga kasalanan upang tayo’y maging marapat sa pagdiriwang ng banal na misteryo."""

CONFITEOR_OPEN = """<<A>>Inaamin ko sa makapangyarihang Diyos at sa inyo, mga kapatid, na lubha akong nagkasala sa isip, sa salita, sa gawa, at sa aking pagkukulang; kaya isinasamo ko kay Santa Mariang laging Birhen, sa lahat ng mga anghel at mga banal, at sa inyo, mga kapatid, na ako’y ipanalangin sa Panginoong ating Diyos."""

ABSOLUTION_PENITENTIAL = """<<P>>Kaawaan tayo ng makapangyarihang Diyos, patawarin ang ating mga kasalanan, at patnubayan tayo sa buhay na walang hanggan.
<<A>>Amen."""

KYRIE = """<<A>>Panginoon, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami.
<<A>>Kristo, kaawaan mo kami.
<<A>>Kristo, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami."""

GLORIA_FULL = """<<H>>Papuri sa Diyos sa kaitaasan
at sa lupa’y kapayapaan sa mga taong kinalulugdan niya.
Pinupuri ka namin,
dinarangal ka namin,
sinasamba ka namin,
ipinagbubunyi ka namin,
pinasasalamatan ka namin dahil sa dakila mong angking kapurihan.
Panginoong Diyos, Hari ng langit, Diyos Amang makapangyarihan sa lahat.
<<H>>Panginoong Hesukristo, Bugtong na Anak,
Panginoong Diyos, Kordero ng Diyos, Anak ng Ama,
ikaw na nag-aalis ng mga kasalanan ng sanlibutan, maawa ka sa amin;
ikaw na nag-aalis ng mga kasalanan ng sanlibutan, tanggapin mo ang aming kahilingan;
ikaw na naluluklok sa kanan ng Ama, maawa ka sa amin.
<<H>>Sapagkat ikaw lamang ang banal,
ikaw lamang ang Panginoon,
ikaw lamang, O Hesukristo, ang Kataas-taasan,
kasama ng Espiritu Santo sa kadakilaan ng Diyos Ama.
Amen."""

OPENING_PRAYER = """<<P>>Manalangin tayo.
<<A>>Amen."""

# --- Liturgy of the Word ---

LITURGY_WORD_TITLE = """<<H>>PAGPAPAHAYAG NG SALITA NG DIYOS
<<D>>Pamagat ng bahagi — maaaring ipakilala ng komentarista ang Pagpapahayag ng Salita ng Diyos."""

ALLELUIA_SING = """<<H>>ALELUYA! ALELUYA! ALELUYA! ALELUYA!
<<D>>Awitin ang taludtod ng Aleluya ayon sa Leksyunaryo para sa Misang ito nang buo, huwag paikliin."""

ALLELUIA_COMMENTATOR = """<<D>>Kung inaanunsyo ng komentarista ang taludtod bago ang Aleluya, bigkasin nang buo ang taludtod mula sa Leksyunaryo, saka awitin ng bayan ang Aleluya at tugon nang hindi pinaikli."""

GOSPEL_INTRO = """<<P>>Sumainyo ang Panginoon.
<<A>>At sumaiyo rin.
<<D>>Binabasa ng Pari ang buong panimulang diyalogo mula sa Misal, gamit ang buong pangungusap mula sa Leksyunaryo para sa Misang ito.
<<A>>Papuri sa iyo, Panginoon."""

GOSPEL_END = """<<P>>Ang Mabuting Balita ng Panginoon.
<<A>>Pinupuri ka namin, Panginoong Hesukristo."""

# --- Creed & Prayer of the Faithful ---
CREED_1 = """<<A>>Sumasampalataya ako sa Diyos Amang makapangyarihan sa lahat,
na may gawa ng langit at lupa.
Sumasampalataya ako kay Hesukristo, iisang Anak ng Diyos,
Panginoon nating lahat,
nagkatawang-tao Siya lalang ng Espiritu Santo,
ipinanganak ni Santa Mariang Birhen."""

CREED_2 = """<<A>>Pinagpakasakit ni Poncio Pilato, ipinako sa krus, namatay, inilibing.
Nanaog sa kinaroroonan ng mga yumao,
nang may ikatlong araw nabuhay na mag-uli.
Umakyat sa langit.
Naluluklok sa kanan ng Diyos Amang makapangyarihan sa lahat.
Doon magmumulang paririto at huhukom sa nangabubuhay at nangamatay na tao."""

CREED_3 = """<<A>>Sumasampalataya naman ako sa Diyos Espiritu Santo,
sa banal na Simbahang Katolika,
sa kasamahan ng mga banal,
sa kapatawaran ng mga kasalanan,
sa pagkabuhay na muli ng nangamatay na tao
at sa buhay na walang hanggan.
Amen."""

PRAYER_FAITHFUL_1 = """<<D>>Ang Panalangin ng Bayan ay pinangungunahan nang buo ang bawat kahilingan, at buo ang tugon ng bayan.
<<P>>Para sa banal na Simbahan ng Diyos sa buong daigdig, nawa’y bantayan siya ng Panginoon at pagkalooban ng kapayapaan at pagkakaisa ayon sa kanyang kalooban: manalangin tayo.
<<A>>Panginoon, dinggin mo ang aming panalangin."""

PRAYER_FAITHFUL_2 = """<<P>>Tinatapos ng Pari ang Panalangin ng Bayan sa isang buong panalangin, halimbawa:
<<P>>Amang nasa langit, dinggin mo ang mga panalangin ng Simbahan, na aming inihahandog sa pamamagitan ni Kristong aming Panginoon.
<<A>>Amen."""

# --- Liturgy of the Eucharist ---
OFFERTORY_HYMN = """<<D>>Ang liriko ng awit sa paghahandog ay mula sa aklatan ng mga himno."""

LOE_TITLE = """<<H>>PAGDIRIWANG NG HULING HAPUNAN"""

PRAY_BRETHREN = """<<P>>Manalangin kayo, mga kapatid, nang ang aking paghahain at ang inyong paghahain ay maging kalugod-lugod sa Diyos Amang makapangyarihan.
<<A>>Tanggapin nawa ng Panginoon itong paghahain sa iyong mga kamay sa kapurihan niya at karangalan sa ating kapakinabangan at sa buong Sambayanan niyang banal."""

PREFACE_DIALOGUE = """<<P>>Sumainyo ang Panginoon.
<<A>>At sumaiyo rin.
<<P>>Itaas sa Diyos ang inyong puso at diwa.
<<A>>Itinaas na namin sa Panginoon.
<<P>>Pasalamatan natin ang Panginoong ating Diyos.
<<A>>Marapat na siya ay pasalamatan."""

PREFACE_ACCLAIM = """<<D>>Ipinagpapatuloy ng Pari ang Prepasyo ng araw mula sa Misal — ang buong Prepasyo para sa Misang ito — hanggang sa sumali ang bayan sa pag-awit o pagbigkas ng Santo, Santo (Sanctus)."""

SANCTUS = """<<H>>Santo, Santo, Santo
Panginoong Diyos ng mga hukbo!
Napupuno ang langit at lupa ng kadakilaan mo!
Osana sa kaitaasan!
Pinagpala ang naparirito sa ngalan ng Panginoon!
Osana sa kaitaasan!"""

MYSTERY_FAITH = """<<D>>Iniawit o ibinibigkas ng Pari ang panimula sa Misteryo ng Pananampalataya, saka inaawit o ibinibigkas ng bayan ang isa sa mga Memorial Acclamation nang buo:
<<H>>Sa krus mo at pagkabuhay kami’y natubos mong tunay, Poong Hesus naming mahal, iligtas mo kaming tanan ngayon at magpakailanman.
<<D>>o
<<H>>Ipinahahayag namin ang iyong kamatayan, Panginoon, at ipinahahayag ang iyong muling pagkabuhay hanggang sa iyong muling pagparito.
<<D>>o
<<H>>Iligtas mo kami, Tagapagligtas ng sanlibutan, sapagkat sa iyong Krus at muling pagkabuhay ay tinubos mo kami."""

GREAT_AMEN = """<<A>>Amen.
<<D>>Tumutugon ang bayan nang “Amen” sa doksolohiya sa wakas ng Panalanging Eukaristiko."""

OUR_FATHER_ENGLISH = """<<H>>Ama namin, sumasalangit ka,
sambahin ang ngalan mo.
Mapasaamin ang kaharian mo.
Sundin ang loob mo,
dito sa lupa para nang sa langit.
Bigyan mo kami ngayon ng aming kakanin sa araw-araw.
At patawarin mo kami sa aming mga sala,
para nang pagpapatawad namin sa nagkakasala sa amin.
At huwag mo kaming ipahintulot sa tukso,
at iadya mo kami sa lahat ng masama.

<<D>>Teksto ng Ama Namin ayon sa Aklat ng Pagmimisa sa Roma (Ordo ng Misa), buong bigkas o awit."""

COMMUNION_RITE_DELIVER = """<<P>>Hinihiling naming, kami’y iadya sa lahat ng masama, pagkalooban ng kapayapaan araw-araw, iligtas sa kasalanan at ilayo sa lahat ng kapahamakan samantalang aming pinananabikan ang dakilang araw ng pagpapahayag ng Tagapagligtas naming si Hesukristo.
<<A>>Sapagkat iyo ang kaharian at ang kapangyarihan at ang kapurihan magpakailanman! Amen."""

SIGN_PEACE = """<<P>>Ang kapayapaan ng Panginoon ay laging sumainyo.
<<A>>At sumaiyo rin.
<<D>>Mag-alayan tayo ng tanda ng kapayapaan."""

LAMB_OF_GOD = """<<H>>Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
maawa ka sa amin.
Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
maawa ka sa amin.
Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
ipagkaloob mo sa amin ang kapayapaan."""

COMMUNION_DIALOGUE = """<<P>>Ito ang Kordero ng Diyos, ito ang nag-aalis ng mga kasalanan ng sanlibutan. Mapalad ang mga inanyayahan sa Hapunan ng Kordero.
<<A>>Panginoon, hindi ako karapat-dapat na magpatuloy sa iyo ngunit sa isang salita mo lamang ay gagaling na ako."""

COMMUNION_HYMN = """<<D>>Ang liriko ng awit sa pakikinabang ay mula sa aklatan ng mga himno."""

POST_COMMUNION = """<<P>>Manalangin tayo.
<<D>>Binibigkas ng Pari ang Panalangin Pagkapakinabang para sa araw nang buo mula sa Misal. Tumutugon ang bayan sa wakas.
<<A>>Amen."""

# --- Announcements & closing ---
ANNOUNCEMENTS_TITLE = """<<H>>MGA ANUNSYO NG SIMBAHAN
<<D>>Ilagay ang buong mga pahayag sa sumusunod na mga slid o i-edit ang deck na ito."""

WELCOME_NEWCOMERS = """<<H>>Maligayang pagdating sa mga panauhin!
<<D>>Opsyonal ang photo collage."""

CONFESSION_SLIDE = """<<H>>Sakramento ng Kumpisal
<<D>>Hindi napapagod ang Panginoon sa pagpapatawad; tayo ang napapagod sa paghahanap ng kanyang awa. — Papa Francisco"""

COLLECTION_PLACEHOLDER = """<<H>>Kolekta ng Misa
<<D>>Sabihing buo ang layunin at petsa."""

SPONSORSHIP = """<<H>>Pag-isponsor ng Pagkain o Misa
<<D>>Ibigay ang buong kontakt ng tagapag-ugnay ng parokya."""

FB_UPDATES = """<<H>>Mga Update at Anunsyo
<<D>>Pangalanan ang pahina ng komunidad at imbitasyong sundin; magdagdag ng QR code kung nais."""

FINAL_BLESSING = """<<P>>Sumainyo ang Panginoon.
<<A>>At sumaiyo rin.
<<P>>Pagpalain nawa kayo ng makapangyarihang Diyos, Ama, at Anak, at Espiritu Santo.
<<A>>Amen.
<<P>>Tapos na ang ating Misa. Humayo kayo at ibahagi si Kristo sa inyong kapwa.
<<A>>Salamat sa Diyos."""

RECESSIONAL_1 = """<<D>>Ang liriko ng pangwakas na awit ay mula sa aklatan ng mga himno."""

RECESSIONAL_2 = """<<D>>Pumili ng isang pangwakas na awit sa Mass Flow o magtala ng liriko sa Lyrics Studio."""
