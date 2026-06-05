"""
GFCC mass flow text. Markers: <<P>> priest, <<A>> all/congregation,
<<D>> direction (italic gold), <<H>> hymn body (white). <<BR>> line break only.

Prayer texts use full wording (Roman Missal, English)—no shortcuts such as “R.”/“V.”
or ellipses in spoken prayer. Variable parts (Collect, Preface, Eucharistic Prayer)
refer explicitly to the Missal for the day.
"""

# --- Pre-Mass & entrance ---
SILENT_REMINDER = """<<H>>PUT YOUR CELLPHONE ON SILENT MODE DURING THE MASS.
Thank you."""

ENTRANCE_HYMN_1 = """<<D>>Entrance hymn lyrics are loaded from the hymn library."""

ENTRANCE_HYMN_2 = """<<D>>Choose one Entrance song in Mass Flow or save lyrics in Lyrics Studio."""

# --- Introductory rites ---
SIGN_CROSS = """<<P>>In the Name of the Father, and of the Son, and of the Holy Spirit.
<<A>>Amen.
<<P>>The Lord be with you.
<<A>>And with your spirit."""

GREETING_EXTENDED = """<<P>>Brothers and sisters, let us acknowledge our sins, and so prepare ourselves to celebrate the sacred mysteries."""

CONFITEOR_OPEN = """<<A>>I confess to almighty God and to you, my brothers and sisters, that I have greatly sinned in my thoughts and in my words, in what I have done and in what I have failed to do; therefore I ask blessed Mary ever-Virgin, all the Angels and Saints, and you, my brothers and sisters, to pray for me to the Lord our God."""

ABSOLUTION_PENITENTIAL = """<<P>>May almighty God have mercy on us, forgive us our sins, and bring us to everlasting life.
<<A>>Amen."""

KYRIE = """<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>           LORD, HAVE MERCY.
<<A>>CHRIST, HAVE MERCY.
<<A>>CHRIST, HAVE MERCY.
<<A>>           CHRIST, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>LORD, HAVE MERCY.
<<A>>           LORD, HAVE MERCY."""

GLORIA_FULL = """<<H>>Glory to God in the highest,
and on earth peace to people of good will.
We praise you,
we bless you,
we adore you,
we glorify you,
we give you thanks for your great glory,
Lord God, heavenly King, O God, almighty Father.
<<H>>Lord Jesus Christ, Only Begotten Son,
Lord God, Lamb of God, Son of the Father,
you take away the sins of the world, have mercy on us;
you take away the sins of the world, receive our prayer;
you are seated at the right hand of the Father, have mercy on us.
<<H>>For you alone are the Holy One,
you alone are the Lord,
you alone are the Most High,
Jesus Christ,
with the Holy Spirit,
in the glory of God the Father.
Amen."""

OPENING_PRAYER = """<<P>>Let us pray.
<<A>>Amen."""

# --- Liturgy of the Word ---

LITURGY_WORD_TITLE = """<<H>>LITURGY OF THE WORD
<<D>>Section title — the commentator may introduce the Liturgy of the Word."""

ALLELUIA_SING = """<<H>>ALLELUIA! ALLELUIA! ALLELUIA! ALLELUIA!
<<D>>Sing the verse of the Gospel Acclamation given in the Lectionary for this Mass in full, not shortened."""

ALLELUIA_COMMENTATOR = """<<D>>If a commentator announces the verse before the Gospel Acclamation, the verse from the Lectionary is spoken in full, and then the assembly sings the Alleluia and response without abbreviation."""

GOSPEL_INTRO = """<<P>>The Lord be with you.
<<A>>And with your spirit.
<<D>>The Priest says the full introductory dialogue from the Roman Missal, using the complete sentence from the Lectionary for this Mass, beginning “A reading from the holy Gospel according to [name the evangelist or book in full, as printed in the Lectionary—never abbreviated].”
<<A>>Glory to you, O Lord."""

GOSPEL_END = """<<P>>The Gospel of the Lord.
<<A>>Praise to you, Lord Jesus Christ."""

# --- Creed & Prayer of the Faithful ---
CREED_1 = """<<A>>I believe in one God,
the Father almighty,
maker of heaven and earth,
of all things visible and invisible.
I believe in one Lord Jesus Christ,
the Only Begotten Son of God,
born of the Father before all ages.
God from God, Light from Light,
true God from true God,
begotten, not made, consubstantial with the Father;
through him all things were made."""

CREED_2 = """<<A>>For us men and for our salvation
he came down from heaven,
and by the Holy Spirit was incarnate of the Virgin Mary, and became man.
For our sake he was crucified under Pontius Pilate,
he suffered death and was buried,
and rose again on the third day in accordance with the Scriptures.
He ascended into heaven
and is seated at the right hand of the Father.
He will come again in glory
to judge the living and the dead
and his kingdom will have no end."""

CREED_3 = """<<A>>I believe in the Holy Spirit, the Lord, the giver of life,
who proceeds from the Father and the Son,
who with the Father and the Son is adored and glorified,
who has spoken through the prophets.
I believe in one, holy, catholic and apostolic Church.
I confess one Baptism for the forgiveness of sins
and I look forward to the resurrection of the dead
and the life of the world to come.
Amen."""

PRAYER_FAITHFUL_1 = """<<D>>The Universal Prayer is led so that each petition is spoken in full and each response by the people is sung or said in full (for example, “Lord, hear our prayer”), never abbreviated.
<<P>>For the holy Church of God throughout the world, that the Lord may guard her and grant her peace and unity according to his will: let us pray to the Lord.
<<A>>Lord, hear our prayer."""

PRAYER_FAITHFUL_2 = """<<P>>The Priest concludes the Prayer of the Faithful with a prayer in full, for example:
<<P>>Heavenly Father, hear the prayers of the Church, which we make through Christ our Lord.
<<A>>Amen."""

# --- Liturgy of the Eucharist ---
OFFERTORY_HYMN = """<<D>>Offertory hymn lyrics are loaded from the hymn library."""

LOE_TITLE = """<<H>>LITURGY OF THE EUCHARIST"""

PRAY_BRETHREN = """<<P>>Pray, brethren, that my sacrifice and yours may be acceptable to God, the almighty Father.
<<A>>May the Lord accept the sacrifice at your hands, for the praise and glory of his name, for our good and the good of all his holy Church."""

PREFACE_DIALOGUE = """<<P>>The Lord be with you.
<<A>>And with your spirit.
<<P>>Lift up your hearts.
<<A>>We lift them up to the Lord.
<<P>>Let us give thanks to the Lord our God.
<<A>>It is right and just."""

PREFACE_ACCLAIM = """<<D>>The Priest continues with the Preface of the day from the Roman Missal — the entire Preface proper for this Mass, not truncated — until the point where the people join in singing or saying the Holy, Holy (Sanctus)."""

SANCTUS = """<<H>>Holy, Holy, Holy Lord God of hosts.
Heaven and earth are full of your glory.
Hosanna in the highest.
Blessed is he who comes in the name of the Lord.
Hosanna in the highest."""

MYSTERY_FAITH = """<<D>>The Priest sings or says the introduction to the Mystery of Faith, then the people sing or say one of these Memorial Acclamations in full:
<<H>>We proclaim your Death, O Lord, and profess your Resurrection until you come again.
<<D>>or
<<H>>When we eat this Bread and drink this Cup, we proclaim your Death, O Lord, until you come again.
<<D>>or
<<H>>Save us, Savior of the world, for by your Cross and Resurrection you have set us free."""

GREAT_AMEN = """<<A>>Amen.
<<D>>The people respond “Amen” once to the doxology at the end of the Eucharistic Prayer, unless local solemn custom repeats it."""

OUR_FATHER_KO_1 = """<<H>>주님의 기도
하늘에 계신 우리 아버지,
아버지 이름 빛나시며
아버지 뜻이 하늘에서와 같이 땅에서도 이루어지소서
저희에게 일용할 양식 주시고,
저희의 죄를 용서하시고
유혹에 빠지지 않게 하시고,
악에서도 저희 구하소서"""

OUR_FATHER_KO_2 = """<<H>>영광이 영원히 아버지의 것입니다.
아멘.
<<D>>Korean text of the Lord’s Prayer from approved diocesan or national use, spoken or sung in full."""

OUR_FATHER_ENGLISH = """<<H>>Our Father, who art in heaven,
hallowed be thy name;
thy kingdom come;
thy will be done
on earth as it is in heaven.
Give us this day our daily bread;
and forgive us our trespasses,
as we forgive those who trespass against us;
and lead us not into temptation,
but deliver us from evil.

<<D>>English text from the Roman Missal (The Order of Mass), in full, as used in this celebration."""

COMMUNION_RITE_DELIVER = """<<P>>Deliver us, Lord, we pray, from every evil, graciously grant peace in our days, that, by the help of your mercy, we may be always free from sin and safe from all distress, as we await the blessed hope and the coming of our Savior, Jesus Christ.
<<A>>For the kingdom, the power, and the glory are yours, now and for ever. Amen."""

SIGN_PEACE = """<<P>>The peace of the Lord be with you always.
<<A>>And with your spirit.
<<D>>Let us offer each other the sign of peace."""

LAMB_OF_GOD = """<<H>>Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
have mercy on us.
Lamb of God,
you take away the sins of the world,
grant us peace."""

COMMUNION_DIALOGUE = """<<P>>Behold the Lamb of God, behold him who takes away the sins of the world. Blessed are those called to the supper of the Lamb.
<<A>>Lord, I am not worthy that you should enter under my roof, but only say the word and my soul shall be healed."""

COMMUNION_HYMN = """<<D>>Communion hymn lyrics are loaded from the hymn library."""

POST_COMMUNION = """<<P>>Let us pray.
<<D>>The Priest says the Post- Communion Prayer for the day in full from the Roman Missal. The people respond at the end.
<<A>>Amen."""

# --- Announcements & closing ---
ANNOUNCEMENTS_TITLE = """<<H>>CHURCH ANNOUNCEMENTS
<<D>>Insert bulletin points with complete sentences on the following slides or edit this deck."""

WELCOME_NEWCOMERS = """<<H>>Welcome newcomers!
<<D>>Photo collage optional."""

CONFESSION_SLIDE = """<<H>>Sacrament of Confession
<<D>>The Lord never tires of forgiving us; we are the ones who tire of seeking his mercy. — Pope Francis"""

COLLECTION_PLACEHOLDER = """<<H>>Mass Collection
<<D>>State the purpose and date in full words. You may add Second Letter to the Corinthians, chapter 9, verse 7 if you include the full quotation."""

SPONSORSHIP = """<<H>>Food or Mass Sponsorship
<<D>>Give the parish coordinator’s complete contact information in words, not abbreviations."""

FB_UPDATES = """<<H>>Updates and Announcements
<<D>>Name your community page and invitation to follow in full; add a QR code to the slide master if you wish."""

FINAL_BLESSING = """<<P>>The Lord be with you.
<<A>>And with your spirit.
<<P>>May almighty God bless you, the Father, and the Son, and the Holy Spirit.
<<A>>Amen.
<<P>>Go in peace, glorifying the Lord by your life.
<<A>>Thanks be to God."""

RECESSIONAL_1 = """<<D>>Recessional hymn lyrics are loaded from the hymn library."""

RECESSIONAL_2 = """<<D>>Choose one Recessional song in Mass Flow or save lyrics in Lyrics Studio."""
