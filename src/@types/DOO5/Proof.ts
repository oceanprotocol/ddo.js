export interface Proof {
  type: string
  proofPurpose: string //assertionMethod
  created: Date
  verificationMethod: string
  Jws: string
}
