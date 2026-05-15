export interface Employee {
  username: string;
  fullName: string;
  role: string;
  passwordId: string;
}

export const EMPLOYEES: Employee[] = [
  { username: "Suganya", fullName: "Suganya Arunkumar", role: "Stakeholder", passwordId: "PHSA01" },
  { username: "Arunkumar", fullName: "Arunkumar Thangaraj", role: "Stakeholder", passwordId: "PHAT02" },
  { username: "Praveenbalaji", fullName: "Praveenbalaji S", role: "Host", passwordId: "PHPS03" },
  { username: "Suchit", fullName: "Suchit Jeeva", role: "Cook", passwordId: "PHSJ04" },
  { username: "SRI RAAMAN", fullName: "SRI RAAMAN S", role: "Video Editor", passwordId: "PHSR05" },
  { username: "Vijayakumar", fullName: "Vijayakumar M", role: "Host", passwordId: "PHVK06" },
  { username: "Arun", fullName: "Arun Kumar", role: "Cook", passwordId: "PHAK07" },
  { username: "Sanjay", fullName: "Sanjay Nagabalan", role: "Temp", passwordId: "PHSN08" },
  { username: "Phebe", fullName: "Phebe Jusnita", role: "Host", passwordId: "PHPJ03" },
];
