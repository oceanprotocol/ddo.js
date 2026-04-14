let rdf: any;
let SHACLValidator: any;

export const getRdfjsLibraries = async () => {
  if (!rdf) {
    // Browser-compatible RDF environment (no filesystem access needed)
    const envModule = await import('@zazuko/env');
    rdf = envModule.default;
  }

  if (!SHACLValidator) {
    const shaclModule = await import('rdf-validate-shacl');
    SHACLValidator = shaclModule.default;
  }

  return { rdf, SHACLValidator };
};
