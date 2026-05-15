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
}


def get_prayer(name: str) -> str:
    """
    Return marked prayer text for slide rendering.
    Keys: penitential_act, gloria, nicene_creed, our_father, holy_holy, mystery_of_faith, lamb_of_god.
    """
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    key = _ALIASES.get(key, key)
    return _PRAYERS.get(key, f"<<D>>Unknown prayer key: {name}\n<<D>>Use get_prayer_keys() for valid names.")


def get_prayer_keys() -> tuple[str, ...]:
    return tuple(sorted(_PRAYERS.keys()))
