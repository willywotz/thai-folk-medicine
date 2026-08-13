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

export interface Remedy {
  id: number;
  healerId: number;
  name: string;
  symptoms: string;
  ingredients: string;
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
