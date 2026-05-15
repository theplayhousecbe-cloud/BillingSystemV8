export interface Employee {
  username: string;
  fullName: string;
  role: string;
  passwordId: string;
  access?: string;
}

export const EMPLOYEES: Employee[] = [
  { username: "Suganya", fullName: "Suganya Arunkumar", role: "Stakeholder", passwordId: "PHSA01", access: "Full" },
  { username: "Arunkumar", fullName: "Arunkumar Thangaraj", role: "Stakeholder", passwordId: "PHAT02", access: "Full" },
  { username: "Praveenbalaji", fullName: "Praveenbalaji S", role: "Host", passwordId: "PHPS03", access: "Low" },
  { username: "Suchit", fullName: "Suchit Jeeva", role: "Cook", passwordId: "PHSJ04", access: "Low" },
  { username: "SRI RAAMAN", fullName: "SRI RAAMAN S", role: "Video Editor", passwordId: "PHSR05", access: "Low" },
  { username: "Vijayakumar", fullName: "Vijayakumar Kumar", role: "Host", passwordId: "PHVK06", access: "Low" },
  { username: "Arun", fullName: "Arun", role: "Cook", passwordId: "PHAK07", access: "Low" },
  { username: "Sanjay", fullName: "Sanjay Nagabalan", role: "Admin", passwordId: "PHSN08", access: "Full" },
  { username: "Phebe", fullName: "Phebe Jusnita", role: "Host", passwordId: "PHPJ03", access: "Low" },
];
