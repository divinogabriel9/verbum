"""Structured Gospel visual concept for AI artwork (never for typography)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional

from services.gospel_mood import infer_gospel_mood_key_from_preview
from services.gospel_visual_prompt import build_visual_scene_line
from services.mass_divider.types import AI_STYLE_DEFAULT, GospelVisualAnalysis

_MOOD_TO_STYLE = {
    "triumphant": "cinematic",
    "solemn": "renaissance",
    "mercy": "realistic",
    "journey": "cinematic",
    "reverent": "stained_glass",
}

_MOOD_THEMES = {
    "triumphant": ("Resurrection hope", ["Victory", "Joy", "Glory"], ["hopeful", "radiant", "triumphant"]),
    "solemn": ("Repentance and conversion", ["Humility", "Vigil", "Mercy"], ["solemn", "reverent", "quiet"]),
    "mercy": ("Divine mercy", ["Healing", "Compassion", "Welcome"], ["tender", "hopeful", "intimate"]),
    "journey": ("Discipleship", ["Calling", "Perseverance", "Mission"], ["earnest", "hopeful", "reverent"]),
    "reverent": ("Sacred encounter", ["Worship", "Awe", "Faith"], ["reverent", "intimate", "hopeful"]),
}

_MOOD_METAPHOR = {
    "triumphant": "Radiant heavenly light breaking through darkness",
    "solemn": "A single warm light emerging from surrounding shadow",
    "mercy": "Soft divine light resting on the wounded and the poor",
    "journey": "A path of light leading through an open landscape",
    "reverent": "Quiet sacred light filling a still biblical space",
}

_DEFAULT_MUST_AVOID = (
    "standing frontal Jesus with open arms and a halo of disciples behind him; "
    "identical stock teaching pose reused across unrelated Gospels; "
    "generic Sunday-school classroom staging"
)


@dataclass(frozen=True)
class _SceneMatch:
    theme: str
    concept: str
    action: str
    focal: str
    environment: str
    camera: str
    supporting: str = ""
    # Story-specific metaphor; when set, overrides generic mood metaphor in prompts.
    metaphor: str = ""


# Keyword → concrete pericope staging. First match wins; keep specific before generic.
_SUBJECT_RULES: tuple[tuple[tuple[str, ...], _SceneMatch], ...] = (
    (
        ("canaanite", "syrophoenician", "great is your faith", "o woman"),
        _SceneMatch(
            "Persistent faith",
            "A humble woman kneeling before Christ with outstretched hands, pleading for her daughter",
            "Woman kneels and reaches toward Christ; Christ turns, listens, then extends a blessing hand",
            "Woman approaching Christ in persistent petition",
            "Dusty road near Tyre and Sidon, sparse landscape, late afternoon light",
            "Medium shot, slightly low angle on the woman, Christ mid-right in three-quarter profile",
            "Disciples hanging back, uncertain",
        ),
    ),
    (
        ("walk on", "walking on the water", "sea of galilee", "come on the water"),
        _SceneMatch(
            "Trust amid the storm",
            "Christ walking toward the boat across dark stormy water while Peter steps out",
            "Christ strides on waves toward Peter, who is half-sinking, arm outstretched",
            "Christ and Peter on the stormy sea",
            "Night Sea of Galilee, churning waves, wind-torn sky, distant fishing boat",
            "Wide cinematic shot with low horizon, figures small against the storm",
            "Disciples clinging to the boat rails",
        ),
    ),
    (
        ("prodigal",),
        _SceneMatch(
            "The Father's mercy",
            "A father running to embrace his returning son on a dusty road",
            "Father rushes forward and wraps the son in a fierce embrace; son collapses into it",
            "Father embracing his returning son",
            "Rural estate road at golden hour, open fields, distant house",
            "Intimate medium shot of the embrace, warm side light",
            "Older brother watching from a doorway in the distance",
        ),
    ),
    (
        ("good shepherd", "lost sheep"),
        _SceneMatch(
            "The Good Shepherd",
            "Christ the shepherd carrying a lamb across rocky pasture",
            "Christ carries a lamb on his shoulders, stepping carefully over uneven ground",
            "Christ the Good Shepherd with a lamb",
            "Rocky Judean hillside at dusk, sparse olive trees",
            "Three-quarter figure shot, Christ in motion across the frame",
            "Flock faintly visible in the midground",
        ),
    ),
    (
        ("loaves", "fishes", "five thousand", "multipli", "seven loaves"),
        _SceneMatch(
            "Divine provision",
            "Christ blessing bread and fish among a vast hillside crowd",
            "Christ lifts bread in blessing while baskets are passed through the crowd",
            "Christ blessing the loaves among the crowd",
            "Grassy hillside overlooking water, late day crowd filling the midground",
            "Slightly elevated wide shot showing both Christ and the multitude",
            "Apostles distributing baskets",
        ),
    ),
    (
        ("last supper", "this is my body", "this is my blood"),
        _SceneMatch(
            "The Eucharist",
            "Christ at table with the apostles, bread and cup before him",
            "Christ breaks bread at the center of the table; apostles lean in",
            "Christ breaking bread at the Last Supper",
            "Upper room interior, warm lamp light, long table",
            "Eye-level along the table, Christ slightly off-center right",
            "Twelve apostles seated around the table",
        ),
    ),
    (
        ("crucifix", "calvary", "golgotha", "crucified"),
        _SceneMatch(
            "The Passion",
            "Christ on the cross beneath a darkened sky",
            "Christ hangs on the cross; Mary and the beloved disciple stand below",
            "Christ crucified on Calvary",
            "Golgotha under a storm-dark sky, barren hill",
            "Low-angle solemn framing looking up toward the cross",
            "Mary and John at the foot of the cross",
        ),
    ),
    (
        ("empty tomb", "he is risen", "resurrection", "rolled away"),
        _SceneMatch(
            "The Resurrection",
            "The empty tomb at dawn with radiant light and discarded burial cloths",
            "Dawn light pours from an open rock tomb; burial cloths lie empty",
            "Empty tomb at Easter dawn",
            "Garden tomb at first light, dew on stone, open doorway glowing",
            "Wide shot with the tomb mouth as the luminous focal point",
            "Mary Magdalene approaching from the side path",
        ),
    ),
    (
        ("annunciation", "gabriel"),
        _SceneMatch(
            "The Annunciation",
            "Mary receiving the angel in a quiet interior",
            "Mary turns from prayer as Gabriel bows with a gesture of announcement",
            "Mary and the angel Gabriel",
            "Simple Nazareth room, soft morning light through a window",
            "Intimate two-shot, quiet vertical light between them",
        ),
    ),
    (
        ("nativity", "manger", "bethlehem", "swaddling"),
        _SceneMatch(
            "The Nativity",
            "The Holy Family in a humble stable, warm lantern light",
            "Mary cradles the infant while Joseph watches protectively",
            "Holy Family at the manger",
            "Humble stable at night, straw, warm lantern glow against cool night",
            "Close intimate grouping around the manger",
            "Shepherds arriving at the entrance",
        ),
    ),
    (
        ("baptism", "jordan"),
        _SceneMatch(
            "The Baptism of the Lord",
            "Christ standing in the Jordan as light descends",
            "John pours water over Christ in the river; heavens open above",
            "Christ baptized in the Jordan",
            "Jordan River banks with reeds, bright sky opening overhead",
            "Vertical light shaft as camera focus, figures waist-deep in water",
            "John the Baptist beside Christ",
        ),
    ),
    (
        ("blind", "sight", "bartimaeus"),
        _SceneMatch(
            "Healing of the blind",
            "Christ gently restoring sight to a kneeling man by the roadside",
            "Christ touches the man's eyes; the man kneels, face lifted toward the touch",
            "Christ healing a blind man",
            "Dusty roadside outside Jericho, afternoon sun",
            "Tight emotional medium shot on the touch and faces",
            "Onlookers at a respectful distance",
        ),
    ),
    (
        ("paralyt", "pick up your mat", "take up your mat"),
        _SceneMatch(
            "Healing and forgiveness",
            "Christ commanding a paralytic to rise and take his mat",
            "The healed man stands and rolls his mat while Christ gestures him forward",
            "Christ and the rising paralytic",
            "Crowded house interior with opened roof light pouring down",
            "Dynamic medium shot capturing motion of standing up",
            "Friends who lowered him watching in awe",
        ),
    ),
    (
        ("storm", "waves", "boat", "rebuked the wind", "peace! be still"),
        _SceneMatch(
            "Peace in the storm",
            "Christ calming the sea from a small fishing boat",
            "Christ stands in the boat with a commanding gesture; waves begin to fall still",
            "Christ calming the storm from the boat",
            "Small fishing boat on violent then-settling water under torn clouds",
            "Wide storm composition with boat mid-right, sky dominating",
            "Terrified disciples clinging to ropes and rails",
        ),
    ),
    (
        ("sower", "seed fell", "birds came", "rocky ground", "among thorns", "good soil"),
        _SceneMatch(
            "Parable of the Sower",
            "A sower casting seed across a hillside with varied ground — path, rocks, thorns, and rich soil",
            "Sower strides and casts seed in a wide arc; birds lift from the path, thorns tangle nearby",
            "The sower at work on the hillside",
            "Agricultural hillside with path, rocky patches, thorn bushes, and fertile soil in one frame",
            "Wide landscape with the sower moving left-to-right across the frame",
            "Birds snatching seed on the path",
        ),
    ),
    (
        ("vine", "branches", "vinedresser", "pruned"),
        _SceneMatch(
            "The True Vine",
            "A living vineyard with strong vine and fruitful branches under tending hands",
            "A vinedresser prunes and tends branches heavy with grapes",
            "Living vine and fruitful branches",
            "Sunlit vineyard rows, twisted ancient vine stock, green leaves",
            "Close-to-medium detail on vine, grapes, and tending hands",
            "Optional distant Christ figure walking the rows",
        ),
    ),
    (
        ("mustard seed", "becomes a tree", "birds of the air nest"),
        _SceneMatch(
            "Mustard seed parable",
            "A small seed in a hand contrasted with a large sheltering mustard shrub",
            "Tiny seed held in an open palm while a large bush shelters birds behind",
            "Mustard seed and the great shrub",
            "Garden plot growing into a large shrub with birds nesting in branches",
            "Split attention: intimate hand foreground, large plant midground",
            "Birds nesting in the branches",
        ),
    ),
    (
        (
            "wedding banquet",
            "wedding feast",
            "marriage feast",
            "wedding garment",
            "wedding guests",
            "fattened cattle",
            "many are invited",
        ),
        _SceneMatch(
            "Wedding banquet parable",
            "In a lamp-lit royal banquet hall, the king confronts a silent guest who lacks a wedding garment while attendants turn him toward the dark doorway outside",
            "King points in judgment; the ungamented guest stands mute; attendants bind his hands and steer him toward outer darkness; the long feast table and mixed guests fill the midground",
            "The king confronting the guest without a wedding garment",
            "Royal banquet hall at night: long laden table, warm lamp glow inside, pitch-dark threshold outside",
            "Wide interior with the confrontation mid-right and the dark doorway as a secondary void",
            "Mixed street-guests at table; servants; attendants at the king's signal",
            "Many are invited into the light of the feast; the unready are turned toward outer darkness",
        ),
    ),
    (
        ("ten virgins", "wise virgins", "foolish virgins", "oil in their lamps", "trim their lamps"),
        _SceneMatch(
            "Parable of the ten virgins",
            "At night outside a wedding door, wise virgins hold bright lamps while foolish ones lift empty lamps as the bridegroom arrives",
            "Bridegroom approaches; five lamps blaze and five sputter out; the door begins to close",
            "Wise and foolish virgins at the midnight arrival",
            "Night path to a torch-lit wedding doorway, cool moonlight and warm threshold glow",
            "Wide night scene with the doorway as the bright focal cut",
            "Procession figures and the closing door",
            "Those ready enter the feast; the unprepared remain outside in the night",
        ),
    ),
    (
        ("five talents", "two talents", "one talent", "buried it in the ground", "wicked lazy", "ten minas"),
        _SceneMatch(
            "Parable of the talents",
            "A master settles accounts: two servants present multiplied coins while a third returns a single buried talent",
            "Master extends an open hand in reckoning; one servant kneels with a dirt-stained coin; others stand with full bags",
            "The master reckoning with the servants",
            "Estate courtyard at late day, chests and coin bags on a low table",
            "Medium-wide confrontation across the accounting table",
            "Three servants in contrasting postures of joy and fear",
            "Faithfulness bears fruit; buried gifts are exposed in the light",
        ),
    ),
    (
        ("eleventh hour", "denarius a day", "last the same as", "hired laborers for his vineyard"),
        _SceneMatch(
            "Workers in the vineyard",
            "At evening payout, late-hired workers receive a full denarius while early workers protest",
            "Landowner places equal coins in outstretched hands; early workers gesture in complaint",
            "Equal wages given at the vineyard gate",
            "Vineyard gate at dusk, baskets of grapes, dust in the last light",
            "Wide gate scene with the pay table mid-right",
            "Lines of laborers, some weary from dawn, some newly arrived",
            "The last become first in the generosity of the kingdom",
        ),
    ),
    (
        (
            "went up to the temple to pray",
            "be merciful to me a sinner",
            "god, i thank you that i am not",
            "pharisee and the tax collector",
        ),
        _SceneMatch(
            "Pharisee and the tax collector",
            "In the temple, a Pharisee stands proud in prayer while a tax collector bows low beating his breast",
            "Pharisee lifts his face and hand; tax collector hunches apart near a pillar, fist to chest",
            "Two contrasting prayers in the temple",
            "Temple court colonnade, shafts of light and deep shadow",
            "Split two-shot: pride in light, humility in shadow",
            "Sparse onlookers at a distance",
            "The one who humbles himself is exalted",
        ),
    ),
    (
        ("sheep and the goats", "least of these", "when did we see you hungry", "inherit the kingdom prepared"),
        _SceneMatch(
            "Judgment of the nations",
            "A royal Christ figure separates a crowd: needy people receive care on one side while the indifferent turn away on the other",
            "Christ gestures left and right; servants give food and clothing; others withhold and turn their backs",
            "Christ separating the merciful from the indifferent",
            "Open court before a throne-like seat, dawn light cutting the crowd",
            "Elevated wide judgment composition with clear left/right split",
            "The hungry, thirsty, stranger, and prisoner among the crowd",
            "Mercy shown to the least is mercy shown to Christ",
        ),
    ),
    (
        ("render to caesar", "whose image", "denarius", "tribute"),
        _SceneMatch(
            "Render to Caesar",
            "A coin held between questioning hands in the temple courts",
            "Hands hold up a denarius between Christ and questioners; faces lean in",
            "Coin held between Christ and the questioners",
            "Temple court colonnade, bright stone, public confrontation",
            "Tight focus on the coin and surrounding faces",
            "Pharisees and Herodians pressing close",
        ),
    ),
    (
        ("beatitude", "blessed are", "sermon on the mount", "poor in spirit"),
        _SceneMatch(
            "Sermon on the Mount",
            "Christ seated on a hillside teaching a gathered crowd below",
            "Christ sits teaching with open hands; crowd sits on the slope listening",
            "Christ seated teaching on the hillside",
            "Green hillside overlooking a valley, soft morning light",
            "Slightly elevated wide shot of seated Christ and the seated crowd",
            "Disciples nearest Christ, crowd filling the slope",
        ),
    ),
    (
        ("wash", "feet", "basin", "towel"),
        _SceneMatch(
            "Washing of the feet",
            "Christ kneeling with basin and towel, washing a disciple's feet",
            "Christ kneels and washes Peter's feet; Peter recoils then yields",
            "Christ kneeling to wash Peter's feet",
            "Upper room floor level, basin, towel, warm lamplight",
            "Low intimate angle emphasizing the kneeling service",
            "Other apostles watching in stunned silence",
        ),
    ),
    (
        ("emmaus", "broke the bread", "eyes were opened"),
        _SceneMatch(
            "Road to Emmaus",
            "Two disciples recognize Christ as he breaks bread at a wayside table",
            "Christ breaks bread; the two disciples lean forward in sudden recognition",
            "Christ breaking bread at Emmaus",
            "Wayside inn table at dusk, dusty road visible through the doorway",
            "Intimate table scene, warm interior against cool evening outside",
            "Two disciples opposite Christ",
        ),
    ),
    (
        ("transfigur", "dazzling", "moses", "elijah", "white as light"),
        _SceneMatch(
            "The Transfiguration",
            "Christ radiant on the mountain with Moses and Elijah in glory",
            "Christ stands transfigured in brilliant light; Peter, James, and John fall to the ground",
            "Transfigured Christ on the mountain",
            "High mountain peak, clouds parting, overwhelming radiance",
            "Low angle looking up into the luminous figure",
            "Moses and Elijah flanking; three disciples overwhelmed below",
        ),
    ),
    (
        ("lazarus", "come out", "unbound him"),
        _SceneMatch(
            "Raising of Lazarus",
            "Lazarus emerging from the tomb as Christ calls him forth",
            "Christ gestures toward the open tomb; Lazarus steps out still wrapped in cloths",
            "Christ calling Lazarus from the tomb",
            "Bethany tomb courtyard, stone doorway, tense onlookers",
            "Dramatic medium-wide shot bridging Christ and the tomb mouth",
            "Martha and Mary nearby among the crowd",
        ),
    ),
    (
        ("two by two", "harvest is abundant", "laborers are few", "sent them on ahead"),
        _SceneMatch(
            "Mission of the disciples",
            "Christ sending disciples outward along diverging roads",
            "Christ gestures outward; pairs of disciples walk away with staffs and sandals",
            "Christ sending the disciples on mission",
            "Open crossroads at the edge of a village, morning light",
            "Wide shot with Christ mid-frame and paths radiating outward",
            "Pairs of disciples departing in different directions",
        ),
    ),
    (
        ("children", "let the children", "little children", "become like children"),
        _SceneMatch(
            "Jesus and the children",
            "Christ seated, blessing and welcoming little children brought to him",
            "Christ sits and gathers children close; a child reaches toward his hand",
            "Christ welcoming children",
            "Village courtyard shade, soft afternoon light",
            "Warm eye-level medium shot among the children",
            "Parents bringing children forward; disciples stepping aside",
        ),
    ),
    (
        ("tax collector", "zacchaeus", "sycamore"),
        _SceneMatch(
            "Zacchaeus",
            "Zacchaeus in a sycamore tree as Christ looks up and calls him down",
            "Christ looks upward and beckons; Zacchaeus climbs down eagerly",
            "Christ calling Zacchaeus from the sycamore",
            "Jericho street with a large sycamore, crowd packing the road",
            "Upward glance composition linking Christ below and Zacchaeus above",
            "Crowd parting around the tree",
        ),
    ),
    (
        ("samaritan", "bandits", "innkeeper", "half-dead"),
        _SceneMatch(
            "Good Samaritan",
            "A Samaritan kneeling to tend a wounded traveler on a lonely road",
            "Samaritan kneels, binding wounds; a donkey waits; priest and Levite recede in the distance",
            "Samaritan tending the wounded traveler",
            "Rocky Jericho road, harsh sun, sparse scrub",
            "Close medium on the act of mercy, road stretching behind",
            "Priest and Levite walking away in the distance",
        ),
    ),
    (
        ("martha", "mary", "better part", "sat at the lord"),
        _SceneMatch(
            "Martha and Mary",
            "Mary seated listening at Christ's feet while Martha serves nearby",
            "Christ sits teaching; Mary listens closely; Martha pauses mid-service with a bowl",
            "Christ with Martha and Mary in the house",
            "Domestic Bethany interior, simple furnishings, soft window light",
            "Intimate interior three-figure composition",
            "Martha in motion, Mary at rest",
        ),
    ),
)


_ENV_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("sea", "boat", "waves", "lake", "galilee", "fish"), "Shore and waters of Galilee under open sky"),
    (("desert", "wilderness", "temptation", "forty days"), "Harsh Judean wilderness, bare rock and heat haze"),
    (("tomb", "grave", "burial"), "Garden tomb and stone doorway at quiet dawn"),
    (("temple", "synagogue", "sanhedrin"), "Stone temple courts and colonnades"),
    (("upper room", "table", "supper", "bread", "cup", "meal"), "Lamp-lit interior table setting"),
    (("road", "journey", "way", "emmaus", "walk"), "Dusty road through open countryside"),
    (("mountain", "hillside", "mount "), "Open hillside with wide sky"),
    (("garden", "gethsemane", "olive"), "Olive garden at night, cool moonlight"),
    (("well", "samaria", "draw water"), "Village well in bright midday sun"),
    (("vineyard", "vine", "grapes"), "Sunlit vineyard rows"),
)


_CAMERA_BY_MOOD = {
    "triumphant": "Wide luminous framing with strong upward light and open sky",
    "solemn": "Quiet medium shot with restrained light and deep shadow",
    "mercy": "Intimate eye-level medium shot emphasizing faces and touch",
    "journey": "Wide shot with clear path, movement, and depth into the landscape",
    "reverent": "Still contemplative framing with soft directional light",
}


_ACTION_BY_MOOD = {
    "triumphant": "Figures turn toward overwhelming light; bodies lift with recognition and joy",
    "solemn": "Figures kneel or bow; motion is slow, weighty, and prayerful",
    "mercy": "One figure reaches to heal or welcome; another receives with vulnerable openness",
    "journey": "Figures walk or are sent outward along a path with purposeful stride",
    "reverent": "A quiet sacred encounter: listening, gazing, or kneeling in awe",
}


def _blob(*parts: str) -> str:
    return " ".join((p or "").lower() for p in parts if p)


def _match_scene(blob: str) -> Optional[_SceneMatch]:
    for keys, scene in _SUBJECT_RULES:
        if any(k in blob for k in keys):
            return scene
    return None


def _infer_environment(blob: str, *, fallback: str) -> str:
    for keys, env in _ENV_RULES:
        if any(k in blob for k in keys):
            return env
    return fallback


def _hash_variety(seed: str) -> int:
    """Stable 0–3 bucket so adjacent Sundays can vary framing language."""
    h = 0
    for ch in seed:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h % 4


_VARIETY_CAMERA = (
    "Subject mid-right in three-quarter profile, facing into the text-safe left",
    "Two-figure dialogue spacing with a charged gap between them",
    "Story props and secondary figures carry the midground; Christ not always largest",
    "Slightly elevated wide beat that reads the whole narrative relationship",
)

# Unmatched pericopes: prefer a decisive physical beat over soft establishing language.
_CLIMAX_CUES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("cast him", "outer darkness", "wailing", "grinding"),
     "Judgment at the threshold: the unready figure is turned from the lit hall toward outer darkness"),
    (("healed", "touched", "opened his eyes", "receive your sight"),
     "The healing touch lands — the sufferer receives sight, strength, or cleansing in mid-gesture"),
    (("embrac", "ran to", "fell on his neck"),
     "A running embrace of mercy closes the distance between father and returning child"),
    (("broke the bread", "eyes were opened", "took bread"),
     "Recognition at the breaking of the bread — hands, loaf, and sudden knowing"),
    (("rebuked the wind", "be still", "calmed"),
     "Christ's commanding gesture stills violent water mid-storm"),
    (("pick up", "take up your mat", "rose"),
     "The healed figure rises and gathers the mat while onlookers freeze in awe"),
    (("kneel", "pleaded", "begged", "have mercy"),
     "A kneeling plea meets Christ's turning attention and outstretched hand"),
    (("sent them", "two by two", "go therefore"),
     "Christ sends disciples outward — departure in motion along diverging paths"),
    (("came down", "sycamore", "hurry"),
     "A figure descends from the tree into Christ's call amid a packed street"),
)


def _infer_climax_beat(blob: str, *, scene_line: str = "") -> str:
    """For unmatched Gospels, bias toward a decisive action beat when cues exist."""
    for keys, beat in _CLIMAX_CUES:
        if any(k in blob for k in keys):
            return beat
    line = (scene_line or "").strip()
    if not line:
        return ""
    lowered = line.lower()
    soft = (
        "sacred gospel scene",
        "teaching circle",
        "generic outdoor",
        "story-specific gospel encounter through gesture",
    )
    if any(s in lowered for s in soft):
        return ""
    # Prefer the scene line itself when it already names a concrete action.
    action_words = (
        "cast", "touch", "heal", "kneel", "embrace", "break", "send", "rise",
        "walk", "call", "wash", "bind", "open", "carry", "sow", "gather",
    )
    if any(w in lowered for w in action_words):
        return line
    return f"Decisive narrative beat: {line}"


def analyze_gospel_visual(
    *,
    sunday_title: str = "",
    gospel_reference: str = "",
    gospel_text: str = "",
    gospel_quote: str = "",
    season_key: str = "",
) -> GospelVisualAnalysis:
    """Return structured visual direction. Does not choose layout, fonts, or copy."""
    preview = {
        "title": sunday_title,
        "gospel_reference": gospel_reference,
        "gospel_text": gospel_text,
        "gospel_quote": gospel_quote,
        "season": season_key,
    }
    mood_key = infer_gospel_mood_key_from_preview(preview)
    theme, extras, tones = _MOOD_THEMES.get(mood_key, _MOOD_THEMES["reverent"])
    blob = _blob(sunday_title, gospel_reference, gospel_text[:1200], gospel_quote)
    matched = _match_scene(blob)
    scene_line = build_visual_scene_line(sunday_title, gospel_reference, gospel_text or "")
    variety = _hash_variety(f"{gospel_reference}|{sunday_title}|{mood_key}")

    metaphor = _MOOD_METAPHOR.get(mood_key, _MOOD_METAPHOR["reverent"])
    if matched is not None:
        primary = matched.theme
        visual_concept = matched.concept
        action = matched.action
        focal = matched.focal
        environment = matched.environment
        camera = matched.camera
        supporting = matched.supporting
        if matched.metaphor:
            metaphor = matched.metaphor
    else:
        primary = theme
        climax = _infer_climax_beat(blob, scene_line=scene_line)
        visual_concept = (
            climax
            or scene_line
            or "A concrete Gospel narrative beat with Christ and those he encounters"
        )
        action = _ACTION_BY_MOOD.get(mood_key, _ACTION_BY_MOOD["reverent"])
        if climax:
            action = climax
        lowered_scene = (visual_concept or "").lower()
        if "woman" in lowered_scene:
            focal = "Woman approaching Christ"
        elif "shepherd" in lowered_scene or "lamb" in lowered_scene:
            focal = "Christ the Good Shepherd"
        elif "sower" in lowered_scene or "seed" in lowered_scene:
            focal = "The sower casting seed"
        elif "boat" in lowered_scene or "waves" in lowered_scene:
            focal = "Christ with the disciples on the water"
        elif "disciples" in lowered_scene:
            focal = "Christ with the disciples in a distinct narrative beat"
        elif "generic outdoor" in lowered_scene or "teaching circle" in lowered_scene:
            visual_concept = (
                f"{sunday_title or 'Sunday Gospel'}: the decisive story-specific biblical moment from "
                f"{gospel_reference or 'the Gospel'}, told through gesture, props, and place"
            )
            focal = "The Gospel's central encounter, staged through decisive action and relationship"
        else:
            focal = "The primary Gospel figures in the decisive moment unique to this pericope"
        environment = _infer_environment(
            blob,
            fallback="Concrete biblical place drawn from the reading — not a generic Palestine backdrop",
        )
        camera = f"{_CAMERA_BY_MOOD.get(mood_key, _CAMERA_BY_MOOD['reverent'])}; {_VARIETY_CAMERA[variety]}"
        supporting = "Secondary figures and props that belong only to this Gospel passage"

    secondary = list(extras)
    if matched is not None and theme not in secondary:
        secondary = [theme, *secondary][:3]

    return GospelVisualAnalysis(
        primary_theme=primary,
        secondary_themes=secondary,
        emotional_tone=list(tones),
        visual_concept=visual_concept,
        visual_metaphor=metaphor,
        focal_subject=focal,
        environment=environment,
        action=action,
        camera=camera,
        supporting_figures=supporting,
        must_avoid=_DEFAULT_MUST_AVOID,
        recommended_style=_MOOD_TO_STYLE.get(mood_key, AI_STYLE_DEFAULT),
        mood_key=mood_key,
    )


def analysis_from_liturgical_payload(
    data: Mapping[str, Any],
    *,
    gospel_quote: str = "",
    season_key: str = "",
) -> GospelVisualAnalysis:
    return analyze_gospel_visual(
        sunday_title=str(data.get("title") or ""),
        gospel_reference=str(data.get("gospel_reference") or ""),
        gospel_text=str(data.get("gospel_text") or ""),
        gospel_quote=gospel_quote or str(data.get("gospel_slide_quote") or ""),
        season_key=season_key or str(data.get("season") or ""),
    )
