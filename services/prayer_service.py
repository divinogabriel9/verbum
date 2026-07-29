"""Missal-style prayer text blocks for Mass slides (English + Tagalog Ordo)."""

from __future__ import annotations

from typing import Final

from services.mass_language import normalize_mass_language

_PRAYERS: Final[dict[str, str]] = {
    "penitential_act": """<<P>>Brethren (brothers and sisters), let us acknowledge our sins, and so prepare ourselves to celebrate the sacred mysteries.

<<A>>I confess to almighty God
and to you, my brothers and sisters,
that I have greatly sinned,
in my thoughts and in my words,
in what I have done and in what I have failed to do,
<<D>>(strike chest)
through my fault, through my fault,
through my most grievous fault;
therefore I ask blessed Mary ever-Virgin,
all the Angels and Saints,
and you, my brothers and sisters,
to pray for me to the Lord our God.

<<P>>May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life.

<<A>>Amen.""",
    "penitential_act_tagalog": """<<P>>Mga kapatid, aminin natin ang ating mga kasalanan upang tayo’y maging marapat sa pagdiriwang ng banal na misteryo.

<<A>>Inaamin ko sa makapangyarihang Diyos
at sa inyo, mga kapatid,
na lubha akong nagkasala,
sa isip, sa salita, sa gawa,
at sa aking pagkukulang;
<<D>>(hampasin ang dibdib)
dahil sa aking sala, sa aking sala,
sa aking pinakamalaking sala;
kaya isinasamo ko kay Santa Mariang laging Birhen,
sa lahat ng mga anghel at mga banal,
at sa inyo, mga kapatid,
na ako’y ipanalangin sa Panginoong ating Diyos.

<<P>>Kaawaan tayo ng makapangyarihang Diyos, patawarin ang ating mga kasalanan, at patnubayan tayo sa buhay na walang hanggan.

<<A>>Amen.""",
    "gloria": """<<A>>Glory to God in the highest,
and on earth peace to people of good will.
We praise you, we bless you, we adore you,
we glorify you, we give you thanks
for your great glory,
Lord God, heavenly King, O God, almighty Father.

Lord Jesus Christ, Only Begotten Son,
Lord God, Lamb of God, Son of the Father,
you take away the sins of the world, have mercy on us;
you take away the sins of the world, receive our prayer;
you are seated at the right hand of the Father, have mercy on us.

For you alone are the Holy One,
you alone are the Lord,
you alone are the Most High,
Jesus Christ,
with the Holy Spirit,
in the glory of God the Father.
Amen.""",
    "gloria_tagalog": """<<A>>Papuri sa Diyos sa kaitaasan
at sa lupa’y kapayapaan sa mga taong kinalulugdan niya.
Pinupuri ka namin, dinarangal ka namin,
sinasamba ka namin, ipinagbubunyi ka namin,
pinasasalamatan ka namin dahil sa dakila mong angking kapurihan.
Panginoong Diyos, Hari ng langit,
Diyos Amang makapangyarihan sa lahat.
Panginoong Hesukristo, Bugtong na Anak,
Panginoong Diyos, Kordero ng Diyos, Anak ng Ama.
Ikaw na nag-aalis ng mga kasalanan ng sanlibutan, maawa ka sa amin.
Ikaw na nag-aalis ng mga kasalanan ng sanlibutan, tanggapin mo ang aming kahilingan.
Ikaw na naluluklok sa kanan ng Ama, maawa ka sa amin.
Sapagkat ikaw lamang ang banal,
ikaw lamang ang Panginoon,
ikaw lamang, O Hesukristo, ang Kataas-taasan,
kasama ng Espiritu Santo sa kadakilaan ng Diyos Ama.
Amen.""",
    "nicene_creed": """<<A>>I believe in one God,
the Father almighty,
maker of heaven and earth,
of all things visible and invisible.

I believe in one Lord Jesus Christ,
the Only Begotten Son of God,
born of the Father before all ages.
God from God, Light from Light,
true God from true God,
begotten, not made, consubstantial with the Father;
through him all things were made.
For us men and for our salvation
he came down from heaven,
and by the Holy Spirit was incarnate of the Virgin Mary,
and became man.
For our sake he was crucified under Pontius Pilate,
he suffered death and was buried,
and rose again on the third day
in accordance with the Scriptures.
He ascended into heaven
and is seated at the right hand of the Father.
He will come again in glory
to judge the living and the dead
and his kingdom will have no end.

I believe in the Holy Spirit, the Lord, the giver of life,
who proceeds from the Father and the Son,
who with the Father and the Son is adored and glorified,
who has spoken through the prophets.
I believe in one, holy, catholic and apostolic Church.
I confess one Baptism for the forgiveness of sins
and I look forward to the resurrection of the dead
and the life of the world to come. Amen.""",
    "nicene_creed_tagalog": """<<A>>Sumasampalataya ako sa iisang Diyos,
Amang makapangyarihan sa lahat,
na may gawa ng langit at lupa,
ng lahat ng nakikita at hindi nakikita.
Sumasampalataya ako sa isang Panginoong Hesukristo,
bugtong na Anak ng Diyos,
sumilang sa Ama bago pa magkapanahon.
Diyos buhat sa Diyos, liwanag buhat sa liwanag,
Diyos na totoo buhat sa Diyos na totoo,
sumilang, hindi ginawa, kaisa ng Ama sa pagka-Diyos;
sa pamamagitan Niya ay ginawa ang lahat.
Dahil sa ating mga tao at dahil sa ating kaligtasan,
Siya’y nanaog mula sa kalangitan.
<<D>>(manikluhod)
Nagkatawang-tao Siya lalang ng Espiritu Santo
kay Mariang Birhen at naging tao.
<<D>>(tumayo)
Ipinako Sa krus dahil sa atin sa hatol ni Poncio Pilato;
namatay at inilibing.
Muling Siyang nabuhay sa ikatlong araw ayon sa Banal na Kasulatan;
umakyat Siya sa kalangitan at naluluklok sa kanan ng Ama.
Paririto Siyang muli na may dakilang kapangyarihan
upang hukuman ang mga buhay at ang mga patay;
ang Kanyang paghahari’y walang hanggan.
Sumasampalataya ako sa Espiritu Santo,
Panginoon at nagbibigay-buhay,
na nanggagaling sa Ama at sa Anak.
Sinasamba Siya at pinararangalan kaisa ng Ama at ng Anak.
Nagsalita Siya sa pamamagitan ng mga propeta.
Sumasampalataya ako sa iisang banal na Simbahang Katolika at apostolika.
Gayundin sa isang binyag na ikapagpapatawad ng mga kasalanan.
At hinihintay ko ang muling pagkabuhay ng nangamatay
at sa buhay na walang hanggan. Amen.""",
    "apostles_creed": """<<A>>I believe in God,
the Father almighty,
Creator of heaven and earth,
and in Jesus Christ, his only Son, our Lord,
who was conceived by the Holy Spirit,
born of the Virgin Mary,
suffered under Pontius Pilate,
was crucified, died and was buried;
he descended into hell;
on the third day he rose again from the dead;
he ascended into heaven,
and is seated at the right hand of God the Father almighty;
from there he will come to judge the living and the dead.
I believe in the Holy Spirit,
the holy catholic Church,
the communion of saints,
the forgiveness of sins,
the resurrection of the body,
and life everlasting. Amen.""",
    "apostles_creed_tagalog": """<<A>>Sumasampalataya ako sa Diyos Amang makapangyarihan sa lahat,
na may gawa ng langit at lupa.
Sumasampalataya ako kay Hesukristo, iisang Anak ng Diyos,
Panginoon nating lahat,
nagkatawang-tao Siya lalang ng Espiritu Santo,
ipinanganak ni Santa Mariang Birhen.
Pinagpakasakit ni Poncio Pilato, ipinako sa krus, namatay, inilibing.
Nanaog sa kinaroroonan ng mga yumao,
nang may ikatlong araw nabuhay na mag-uli.
Umakyat sa langit.
Naluluklok sa kanan ng Diyos Amang makapangyarihan sa lahat.
Doon magmumulang paririto at huhukom sa nangabubuhay at nangamatay na tao.
Sumasampalataya naman ako sa Diyos Espiritu Santo,
sa banal na Simbahang Katolika,
sa kasamahan ng mga banal,
sa kapatawaran ng mga kasalanan,
sa pagkabuhay na muli ng nangamatay na tao
at sa buhay na walang hanggan. Amen.""",
    "our_father": """<<A>>Our Father, who art in heaven,
hallowed be thy name;
thy kingdom come,
thy will be done,
on earth as it is in heaven.
Give us this day our daily bread;
and forgive us our trespasses,
as we forgive those who trespass against us;
and lead us not into temptation,
but deliver us from evil.

<<P>>Deliver us, Lord, we pray, from every evil, graciously grant peace in our days, that, by the help of your mercy, we may be always free from sin and safe from all distress, as we await the blessed hope and the coming of our Savior, Jesus Christ.

<<A>>For the kingdom, the power, and the glory are yours now and for ever.""",
    "our_father_malay": """<<A>>Bapa kami yang di syurga,
dikuduskanlah nama-Mu,
datanglah kerajaan-Mu,
jadilah kehendak-Mu,
di atas bumi seperti di dalam syurga.
Berilah kami rezeki pada hari ini,
dan ampunilah kesalahan kami,
seperti kami mengampuni orang yang bersalah kepada kami.
Dan janganlah masukkan kami ke dalam pencubaan,
tetapi lepaskanlah kami daripada yang jahat.

<<A>>Kerana Engkaulah Raja yang mulia dan berkuasa, untuk selama-lamanya. Amin.""",
    "our_father_tagalog": """<<A>>Ama namin, sumasalangit ka,
sambahin ang ngalan mo.
Mapasaamin ang kaharian mo.
Sundin ang loob mo,
dito sa lupa para nang sa langit.
Bigyan mo kami ngayon ng aming kakanin sa araw-araw.
At patawarin mo kami sa aming mga sala,
para nang pagpapatawad namin sa nagkakasala sa amin.
At huwag mo kaming ipahintulot sa tukso,
at iadya mo kami sa lahat ng masama.

<<A>>Sapagkat iyo ang kaharian, at ang kapangyarihan, at ang kapurihan, ngayon at magpakailanman. Amen.""",
    "our_father_visaya": """<<A>>Amahan namo nga anaa sa mga langit,
pagdaygon ang imong ngalan.
Umabot kanamo ang imong gingharian.
Matuman ang imong pagbuot,
dinhi sa yuta maingon sa langit.
Ang kalan-on namo sa matag adlaw, ihatag kanamo karong adlawa.
Ug pasayloa kami sa among mga sala,
ingon nga nagapasaylo kami sa mga nakasala kanamo.
Ug dili mo kami itugyan sa mga panulay,
hinonoa luwasa kami sa dautan.

<<A>>Kay imo ang gingharian, ug ang gahum, ug ang himaya, karon ug sa walay katapusan. Amen.""",
    "our_father_korean": """<<A>>하늘에 계신 우리 아버지,
아버지의 이름이 거룩히 빛나시며
아버지의 나라가 오시며
아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지소서.
오늘 저희에게 일용할 양식을 주시고
저희에게 잘못한 이를 저희가 용서하오니
저희 죄를 용서하시고
저희를 유혹에 빠지지 않게 하시고
악에서 구하소서.

<<A>>주님께 나라와 권능과 영광이 영원히 있나이다. 아멘.""",
    "holy_holy": """<<A>>Holy, Holy, Holy Lord God of hosts.
Heaven and earth are full of your glory.
Hosanna in the highest.
Blessed is he who comes in the name of the Lord.
Hosanna in the highest.""",
    "holy_holy_tagalog": """<<A>>Santo, Santo, Santo
Panginoong Diyos ng mga hukbo!
Napupuno ang langit at lupa ng kadakilaan mo!
Osana sa kaitaasan!
Pinagpala ang naparirito sa ngalan ng Panginoon!
Osana sa kaitaasan!""",
    "mystery_of_faith": """<<A>>We proclaim your Death, O Lord,
and profess your Resurrection
until you come again.

<<D>>(Alternate forms may be used as approved by the Conference of Bishops.)""",
    "mystery_of_faith_tagalog": """<<A>>Sa krus mo at pagkabuhay
kami’y natubos mong tunay,
Poong Hesus naming mahal,
iligtas mo kaming tanan
ngayon at magpakailanman.""",
    "lamb_of_god": """<<A>>Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
grant us peace.""",
    "lamb_of_god_tagalog": """<<A>>Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
maawa ka sa amin.
Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
maawa ka sa amin.
Kordero ng Diyos,
na nag-aalis ng mga kasalanan ng sanlibutan,
ipagkaloob mo sa amin ang kapayapaan.""",
    "kyrie": """<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>CHRIST, HAVE MERCY.
<<A>>CHRIST, HAVE MERCY.
<<A>>CHRIST, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.""",
    "kyrie_tagalog": """<<A>>Panginoon, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami.
<<A>>Kristo, kaawaan mo kami.
<<A>>Kristo, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami.
<<A>>Panginoon, kaawaan mo kami.""",
}

_ALIASES: Final[dict[str, str]] = {
    "penitential": "penitential_act",
    "confiteor": "penitential_act",
    "creed": "nicene_creed",
    "nicene": "nicene_creed",
    "apostles": "apostles_creed",
    "apostles_creed": "apostles_creed",
    "sanctus": "holy_holy",
    "holyholy": "holy_holy",
    "mystery": "mystery_of_faith",
    "agnus": "lamb_of_god",
    "our_father_english": "our_father",
}

_OUR_FATHER_LANGS: Final[dict[str, str]] = {
    "english": "our_father",
    "malay": "our_father_malay",
    "tagalog": "our_father_tagalog",
    "visaya": "our_father_visaya",
    "cebuano": "our_father_visaya",
    "bisaya": "our_father_visaya",
    "korean": "our_father_korean",
}

# Prayer base keys that have a ``_{language}`` variant (tagalog today).
_LOCALIZED_PRAYERS: Final[frozenset[str]] = frozenset(
    {
        "penitential_act",
        "gloria",
        "nicene_creed",
        "apostles_creed",
        "holy_holy",
        "mystery_of_faith",
        "lamb_of_god",
        "kyrie",
    }
)


def get_prayer(name: str, language: str = "english") -> str:
    """
    Return marked prayer text for slide rendering.
    Keys: penitential_act, gloria, nicene_creed, apostles_creed, kyrie,
    our_father, holy_holy, mystery_of_faith, lamb_of_god.
    Optional ``language`` (english | tagalog) selects localized Ordo wording.
    """
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    key = _ALIASES.get(key, key)
    lang = normalize_mass_language(language)
    if lang != "english" and key in _LOCALIZED_PRAYERS:
        localized = f"{key}_{lang}"
        if localized in _PRAYERS:
            return _PRAYERS[localized]
    return _PRAYERS.get(key, f"<<D>>Unknown prayer key: {name}\n<<D>>Use get_prayer_keys() for valid names.")


def get_our_father(choice: str = "english") -> str:
    """
    Return the marked Our Father text for the requested language.
    Accepts: english | malay | tagalog | visaya (cebuano/bisaya) | korean.
    Falls back to English for unknown values.
    """
    lang = (choice or "").strip().lower().replace("-", "_").replace(" ", "_")
    key = _OUR_FATHER_LANGS.get(lang, "our_father")
    return _PRAYERS.get(key, _PRAYERS["our_father"])


def get_prayer_keys() -> tuple[str, ...]:
    return tuple(sorted(_PRAYERS.keys()))
