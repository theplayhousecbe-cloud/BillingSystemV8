export interface Employee {
  username: string;
  fullName: string;
  role: string;
  passwordId: string;
}

export const EMPLOYEES: Employee[] = [
  { username: "Suganya", fullName: "Suganya Arunkumar", role: "admin", passwordId: "PHSA01" },
  { username: "Arunkumar", fullName: "Arunkumar Thangaraj", role: "admin", passwordId: "PHAT02" },
  { username: "Praveenbalaji", fullName: "Praveenbalaji S", role: "host", passwordId: "PHPS03" },
  { username: "Suchit", fullName: "Suchit Jeeva", role: "cook", passwordId: "PHSJ04" },
  { username: "SRI RAAMAN S", fullName: "SRI RAAMAN S", role: "editor", passwordId: "PHSR05" },
  { username: "Vijayakumar", fullName: "Vijayakumar M", role: "host", passwordId: "PHVK06" },
  { username: "Arun", fullName: "Arun Kumar", role: "cook", passwordId: "PHAK07" },
  { username: "Sanjay", fullName: "Sanjay Nagabalan", role: "admin", passwordId: "PHSN08" },
  { username: "Phebe", fullName: "Phebe Jusnita", role: "host", passwordId: "PHPJ03" },
];
