export type CardFormValues = {
  playerName: string;
  cardTitle: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  productLine: string;
  subsetName: string;
  parallel: string;
  cardNumber: string;
  serialNumber: string;
  serialRange: string;
  gradingCompany: string;
  grade: string;
  certNumber: string;
  gradingLink: string;
  visibility: string;
  collectionStatus: string;
  purchaseDate: string;
  purchasePrice: string;
  gradingFee: string;
  totalCost: string;
  currentValue: string;
  purchaseSource: string;
  historyCurrency: string;
  valuationDate: string;
  valuationSource: string;
  tags: string;
  publicDescription: string;
  notes: string;
  isRookie: boolean;
  isAutograph: boolean;
  autoType: string;
  isPatch: boolean;
  patchType: string;
};

export const emptyCardFormValues: CardFormValues = {
  playerName: "",
  cardTitle: "",
  sport: "",
  team: "",
  year: "",
  brand: "",
  productLine: "",
  subsetName: "",
  parallel: "",
  cardNumber: "",
  serialNumber: "",
  serialRange: "",
  gradingCompany: "",
  grade: "",
  certNumber: "",
  gradingLink: "",
  visibility: "private",
  collectionStatus: "holding",
  purchaseDate: "",
  purchasePrice: "",
  gradingFee: "",
  totalCost: "",
  currentValue: "",
  purchaseSource: "",
  historyCurrency: "CNY",
  valuationDate: "",
  valuationSource: "个人估计",
  tags: "",
  publicDescription: "",
  notes: "",
  isRookie: false,
  isAutograph: false,
  autoType: "",
  isPatch: false,
  patchType: ""
};


