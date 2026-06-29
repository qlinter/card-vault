export type CardFormValues = {
  playerName: string;
  cardTitle: string;
  sport: string;
  team: string;
  year: string;
  setName: string;
  cardNumber: string;
  serialNumber: string;
  serialRange: string;
  gradingCompany: string;
  grade: string;
  gradingLink: string;
  purchaseDate: string;
  purchasePrice: string;
  gradingFee: string;
  totalCost: string;
  currentValue: string;
  purchaseSource: string;
  tags: string;
  publicDescription: string;
  notes: string;
  isAutograph: boolean;
  isPatch: boolean;
};

export const emptyCardFormValues: CardFormValues = {
  playerName: "",
  cardTitle: "",
  sport: "",
  team: "",
  year: "",
  setName: "",
  cardNumber: "",
  serialNumber: "",
  serialRange: "",
  gradingCompany: "",
  grade: "",
  gradingLink: "",
  purchaseDate: "",
  purchasePrice: "",
  gradingFee: "",
  totalCost: "",
  currentValue: "",
  purchaseSource: "",
  tags: "",
  publicDescription: "",
  notes: "",
  isAutograph: false,
  isPatch: false
};
