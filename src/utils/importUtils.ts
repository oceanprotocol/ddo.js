let rdf;
let SHACLValidator;
let formats;

export const getRdfjsLibraries = async () => {
  if (!formats) {
    const formatsModule = await import('@rdfjs/formats-common');
    formats = formatsModule.default;
    return formats;
  }

  if (!rdf) {
    const envNode = await import('@zazuko/env-node');
    rdf = envNode.default;
    rdf.formats.import(formats);
  }

  if (!SHACLValidator) {
    const shaclModule = await import('rdf-validate-shacl');
    SHACLValidator = shaclModule.default;
  }

  return { formats, rdf, SHACLValidator };
};
