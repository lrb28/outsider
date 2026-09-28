"""Official member data for House filers (free, public domain).

The House index only carries "Last, First" and a state-district code such as
"CA11". The @unitedstates project publishes every current member of Congress
with their Bioguide ID, official name and party; the Bioguide ID also names
the member's official portrait (public domain) in unitedstates/images.

    https://unitedstates.github.io/congress-legislators/legislators-current.json
    https://unitedstates.github.io/images/congress/225x275/{bioguide}.jpg
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Optional

CURRENT = "https://unitedstates.github.io/congress-legislators/legislators-current.json"
PORTRAIT = "https://unitedstates.github.io/images/congress/225x275/{bioguide}.jpg"
PARTY = {"Democrat": "D", "Republican": "R", "Independent": "I"}
STATE_DST = re.compile(r"^([A-Z]{2})(\d{1,2})$")


@dataclass(frozen=True)
class Member:
    bioguide: str
    name: str
    last: str
    state: str
    district: Optional[int]
    party: Optional[str]

    @property
    def portrait(self) -> str:
        return PORTRAIT.format(bioguide=self.bioguide)

    @property
    def seat(self) -> str:
        """"CA-11", or "AK-AL" for an at-large seat."""
        return f"{self.state}-{self.district if self.district else 'AL'}"


def fold(s: str) -> str:
    """Case- and accent-insensitive key: "Sánchez" and "SANCHEZ" match."""
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z]", "", s.encode("ascii", "ignore").decode().lower())


def parse_members(rows: Iterable[dict]) -> list[Member]:
    out = []
    for r in rows:
        term = (r.get("terms") or [{}])[-1]
        if term.get("type") != "rep":
            continue  # senators are out of scope
        name = r.get("name", {})
        out.append(Member(
            bioguide=r["id"]["bioguide"],
            name=name.get("official_full") or f"{name.get('first', '')} {name.get('last', '')}".strip(),
            last=name.get("last", ""),
            state=term.get("state", ""),
            district=term.get("district") or None,
            party=PARTY.get(term.get("party", "")),
        ))
    return out


class Directory:
    def __init__(self, members: Iterable[Member]):
        self.members = list(members)
        self.by_seat = {(m.state, m.district or 0): m for m in self.members}

    @classmethod
    def load(cls, session=None) -> "Directory":
        import requests

        resp = (session or requests).get(CURRENT, timeout=60)
        resp.raise_for_status()
        return cls(parse_members(resp.json()))

    def match(self, last: str, first: str, state_dst: Optional[str]) -> Optional[Member]:
        """The member behind a House index row, or None.

        The seat decides when its holder has the filer's surname; otherwise
        the surname must be unique within the state (seats move with
        redistricting, and filers sometimes use a maiden or middle name).
        """
        key = fold(last)
        m = STATE_DST.match((state_dst or "").strip().upper())
        state = m.group(1) if m else ""
        if m:
            seat = self.by_seat.get((state, int(m.group(2))))
            if seat and (fold(seat.last) == key or key in fold(seat.name)):
                return seat
        same = [x for x in self.members if x.state == state and (fold(x.last) == key or key in fold(x.name))]
        if len(same) == 1:
            return same[0]
        if len(same) > 1 and first:
            first_key = fold(first.split()[0])
            narrowed = [x for x in same if first_key in fold(x.name)]
            if len(narrowed) == 1:
                return narrowed[0]
        return None
