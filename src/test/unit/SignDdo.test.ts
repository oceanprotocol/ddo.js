import { assert } from 'chai'
import { ethers } from 'ethers'
import { base64url } from 'jose'
import { signCredential, verifyCredential } from '../../services/signDdo.js'
import { IssuerKeyJWK, IssuerPublicKeyJWK } from '../../@types/IssuerSignature.js'


const mockVerifiableCredential = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  credentialSubject: { id: 'did:example:123' },
  issuer: 'did:example:issuer',
  issuanceDate: '2023-01-01T00:00:00Z'
}

describe('Credential Signing and Verification Functions', () => {
  it('should verify the signed credential with the correct public key', async () => {
    const privateKey =
      '0xc494c6e5def4bab63ac29eed19a134c130355f74f019bc74b8f4389df2837a57'
    const wallet = new ethers.Wallet(privateKey)
    const privateKeyBuffer = Buffer.from(privateKey.substring(2), 'hex')
    const publicKeyHex = wallet.signingKey.publicKey
    const publicKeyBuffer = Buffer.from(publicKeyHex.substring(2), 'hex')
    const xBuffer = publicKeyBuffer.slice(1, 33)
    const yBuffer = publicKeyBuffer.slice(33, 65)
    const d = base64url.encode(privateKeyBuffer as any as Uint8Array)
    const x = base64url.encode(xBuffer as any as Uint8Array)
    const y = base64url.encode(yBuffer as any as Uint8Array)

    const privateJwk: IssuerKeyJWK = {
      kty: 'EC',
      crv: 'secp256k1',
      d,
      x,
      y,
      alg: 'ES256K',
      use: 'sig'
    }

    const { jws } = await signCredential(
      mockVerifiableCredential,
      privateJwk,
      publicKeyHex
    )

    const publicJwk = {
      kty: 'EC',
      crv: 'secp256k1',
      x,
      y,
      alg: 'ES256K',
      use: 'sig'
    }

    const payload = await verifyCredential(jws, publicJwk)
    assert.deepEqual(
      {
        type: payload.type,
        credentialSubject: payload.credentialSubject,
        issuer: payload.issuer,
        issuanceDate: payload.issuanceDate
      },
      {
        type: mockVerifiableCredential.type,
        credentialSubject: mockVerifiableCredential.credentialSubject,
        issuer: mockVerifiableCredential.issuer,
        issuanceDate: mockVerifiableCredential.issuanceDate
      },
      'Payload should match the original credential'
    )
  })

  it('should throw an error if verification fails due to an invalid signature', async () => {
    const privateKey =
      '0xc494c6e5def4bab63ac29eed19a134c130355f74f019bc74b8f4389df2837a57'
    const invalidPublicKey =
      '0x0491d20394c7c2b191c6db3a3a9e7eac21d9c6741dcf66010e0a743530d8c1b05656fb9b555ebc4162df5d1cf3e372a4e0230205932c27fcd998bdbe26399236f9'

    const wallet = new ethers.Wallet(privateKey)
    const { publicKey } = wallet.signingKey
    const privateKeyBuffer = Buffer.from(privateKey.substring(2), 'hex')
    const publicKeyHex = wallet.signingKey.publicKey
    const publicKeyBuffer = Buffer.from(publicKeyHex.substring(2), 'hex')
    const xBuffer = publicKeyBuffer.slice(1, 33)
    const yBuffer = publicKeyBuffer.slice(33, 65)
    const d = base64url.encode(privateKeyBuffer as any as Uint8Array)
    const x = base64url.encode(xBuffer as any as Uint8Array)
    const y = base64url.encode(yBuffer as any as Uint8Array)

    const privateJwk: IssuerKeyJWK = {
      kty: 'EC',
      crv: 'secp256k1',
      d,
      x,
      y,
      alg: 'ES256K',
      use: 'sig'
    }

    const { jws } = await signCredential(
      mockVerifiableCredential,
      privateJwk,
      publicKey
    )

    const invalidPublicKeyBuffer = Buffer.from(invalidPublicKey.substring(2), 'hex')
    const invalidXBuffer = invalidPublicKeyBuffer.slice(1, 33)
    const invalidYBuffer = invalidPublicKeyBuffer.slice(33, 65)

    const invalidX = base64url.encode(invalidXBuffer as any as Uint8Array)
    const invalidY = base64url.encode(invalidYBuffer as any as Uint8Array)
    const publicJwk: IssuerPublicKeyJWK = {
      kty: 'EC',
      crv: 'secp256k1',
      x: invalidX,
      y: invalidY,
      alg: 'ES256K',
      use: 'sig'
    }

    try {
      await verifyCredential(jws, publicJwk)
      assert.fail('Expected error to be thrown')
    } catch (error: any) {
      assert.include(
        error.message,
        'Invalid JWK EC key',
        'Error should indicate failed verification'
      )
    }
  })
})
