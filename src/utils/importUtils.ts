let SHACLValidator: any;

export const getSHACLValidator = async () => {
  if (!SHACLValidator) {
    const module = await import('rdf-validate-shacl');
    SHACLValidator = module.default;
  }
  return SHACLValidator;
};
