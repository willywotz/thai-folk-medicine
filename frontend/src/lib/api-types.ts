export interface Province {
  id: number;
  nameThai: string;
  nameEnglish: string;
}

export interface District {
  id: number;
  provinceId: number;
  nameThai: string;
  nameEnglish: string;
}

export interface Healer {
  id: number;
  districtId: number;
  fullName: string;
  subDistrict: string;
  specialty: string;
  biography: string;
  createdAt: string;
  updatedAt: string;
}

export interface Herb {
  id: number;
  nameThai: string;
  nameEnglish: string;
  scientificName: string;
  properties: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemedyHerb {
  herbId: number;
  nameThai: string;
  nameEnglish: string;
  amount: string;
}

export interface Remedy {
  id: number;
  healerId: number;
  name: string;
  symptoms: string;
  herbs: RemedyHerb[];
  preparationMethod: string;
  usage: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentCase {
  id: number;
  remedyId: number;
  healerId: number;
  patientAge: number;
  patientSex: string;
  symptoms: string;
  result: string;
  note: string;
  treatedOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: number;
  ownerType: string;
  ownerId: number;
  caption: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchHit {
  type: "remedy" | "healer" | "herb";
  id: number;
  title: string;
  subtitle: string;
  score: number;
}
