"""English Missal-style prayer text blocks for Mass slides (placeholders, expandable)."""

from __future__ import annotations

from typing import Final

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
    "mystery_of_faith": """<<A>>We proclaim your Death, O Lord,
and profess your Resurrection
until you come again.

<<D>>(Alternate forms may be used as approved by the Conference of Bishops.)""",
    "lamb_of_god": """<<A>>Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
grant us peace.""",
}

_ALIASES: Final[dict[str, str]] = {
    "penitential": "penitential_act",
    "confiteor": "penitential_act",
    "creed": "nicene_creed",
    "nicene": "nicene_creed",
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


def get_prayer(name: str) -> str:
    """
    Return marked prayer text for slide rendering.
    Keys: penitential_act, gloria, nicene_creed, our_father, holy_holy, mystery_of_faith, lamb_of_god.
    """
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    key = _ALIASES.get(key, key)
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
