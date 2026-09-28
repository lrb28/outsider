from outsider_ingest.providers.legislators import Directory, parse_members

ROWS = [
    {"id": {"bioguide": "P000197"}, "name": {"first": "Nancy", "last": "Pelosi", "official_full": "Nancy Pelosi"},
     "terms": [{"type": "rep", "state": "CA", "district": 11, "party": "Democrat"}]},
    {"id": {"bioguide": "S000168"}, "name": {"first": "Maria", "last": "Salazar", "official_full": "Maria Elvira Salazar"},
     "terms": [{"type": "rep", "state": "FL", "district": 27, "party": "Republican"}]},
    {"id": {"bioguide": "F000484"}, "name": {"first": "Scott", "last": "Franklin", "official_full": "C. Scott Franklin"},
     "terms": [{"type": "rep", "state": "FL", "district": 18, "party": "Republican"}]},
    {"id": {"bioguide": "S000001"}, "name": {"first": "Ann", "last": "Senator", "official_full": "Ann Senator"},
     "terms": [{"type": "sen", "state": "CA", "party": "Democrat"}]},
    {"id": {"bioguide": "A000001"}, "name": {"first": "Al", "last": "Large", "official_full": "Al Large"},
     "terms": [{"type": "rep", "state": "AK", "district": 0, "party": "Republican"}]},
]


def test_only_representatives_are_listed():
    members = parse_members(ROWS)
    assert {m.bioguide for m in members} == {"P000197", "S000168", "F000484", "A000001"}


def test_seat_and_surname_decide():
    d = Directory(parse_members(ROWS))
    m = d.match("Pelosi", "Nancy", "CA11")
    assert m and m.bioguide == "P000197" and m.party == "D" and m.seat == "CA-11"
    assert m.portrait.endswith("/225x275/P000197.jpg")


def test_redistricted_member_matches_by_unique_surname_in_state():
    d = Directory(parse_members(ROWS))
    assert d.match("Franklin", "Scott Scott", "FL15").name == "C. Scott Franklin"


def test_accents_and_case_are_ignored():
    d = Directory(parse_members(ROWS))
    assert d.match("SALAZAR", "María Elvira", "FL27").bioguide == "S000168"


def test_at_large_seat_and_unknown_filer():
    d = Directory(parse_members(ROWS))
    assert d.match("Large", "Al", "AK00").seat == "AK-AL"
    assert d.match("Nobody", "Jane", "TX07") is None
