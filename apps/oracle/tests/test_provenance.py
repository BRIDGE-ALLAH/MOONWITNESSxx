from oracle.provenance import sha256_digest


def test_digest_is_stable_for_equivalent_mapping_order() -> None:
    assert sha256_digest({"a": 1, "b": 2}) == sha256_digest({"b": 2, "a": 1})


def test_digest_changes_when_input_changes() -> None:
    assert sha256_digest({"values": [1, 2]}) != sha256_digest({"values": [1, 3]})
