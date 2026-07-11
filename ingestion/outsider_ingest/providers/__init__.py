"""Provider layer (ports & adapters).

Business logic depends only on the abstract base classes in `base`. Concrete
adapters wrap a single external source each. Swapping a free source for a paid
one (Stooq -> Polygon) is a new adapter + a config change, never a logic edit.
"""
