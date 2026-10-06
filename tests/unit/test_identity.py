import pytest
from backend.identity.did import generate_key_pair, public_key_to_did, private_key_to_pem, pem_to_public_key, generate_did_document
from backend.identity.credentials import issue_credential, verify_credential

def test_did_generation():
    priv, pub = generate_key_pair()
    did = public_key_to_did(pub)
    
    assert did.startswith("did:key:z")
    
    doc = generate_did_document(did)
    assert doc["id"] == did
    assert doc["verificationMethod"][0]["controller"] == did

def test_credential_issuance_and_verification():
    issuer_priv, issuer_pub = generate_key_pair()
    issuer_did = public_key_to_did(issuer_pub)
    issuer_priv_pem = private_key_to_pem(issuer_priv)
    
    subject_priv, subject_pub = generate_key_pair()
    subject_did = public_key_to_did(subject_pub)
    
    capabilities = ["test_capability"]
    role = "test_role"
    
    # Issue
    jwt_token = issue_credential(
        issuer_did=issuer_did,
        issuer_private_key_pem=issuer_priv_pem,
        subject_did=subject_did,
        capabilities=capabilities,
        role=role
    )
    
    assert isinstance(jwt_token, str)
    assert len(jwt_token.split(".")) == 3
    
    # Verify
    issuer_pub_pem = issuer_pub.public_bytes(
        encoding=__import__('cryptography.hazmat.primitives.serialization', fromlist=['serialization']).Encoding.PEM,
        format=__import__('cryptography.hazmat.primitives.serialization', fromlist=['serialization']).PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    subject = verify_credential(jwt_token, issuer_pub_pem, expected_subject_did=subject_did)
    
    assert subject["id"] == subject_did
    assert subject["role"] == role
    assert subject["capabilities"] == capabilities

def test_verify_credential_wrong_subject():
    issuer_priv, issuer_pub = generate_key_pair()
    issuer_did = public_key_to_did(issuer_pub)
    issuer_priv_pem = private_key_to_pem(issuer_priv)
    
    subject_did = "did:key:zTestSubject"
    
    jwt_token = issue_credential(
        issuer_did=issuer_did,
        issuer_private_key_pem=issuer_priv_pem,
        subject_did=subject_did,
        capabilities=["a"],
        role="b"
    )
    
    issuer_pub_pem = issuer_pub.public_bytes(
        encoding=__import__('cryptography.hazmat.primitives.serialization', fromlist=['serialization']).Encoding.PEM,
        format=__import__('cryptography.hazmat.primitives.serialization', fromlist=['serialization']).PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    with pytest.raises(ValueError, match="does not match expected"):
        verify_credential(jwt_token, issuer_pub_pem, expected_subject_did="did:key:zWrong")
