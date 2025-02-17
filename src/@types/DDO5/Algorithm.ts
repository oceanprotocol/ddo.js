export interface Algorithm {
  container: Container;
  language?: string;
  version?: string;
  consumerParameters?: ConsumerParameter[];
}

export interface ConsumerParameter {
  name: string;
  type: string;
  label: string;
  required: boolean;
  description: string;
  default: string | number | boolean;
  options: Option[];
}

export interface Option {
  [key: string]: string | number | boolean | OptionDetail[];
}

export interface OptionDetail {
  [key: string]: string;
}

export interface Container {
  image: string;
  tag: string;
  entrypoint: string;
  checksum: string;
}
