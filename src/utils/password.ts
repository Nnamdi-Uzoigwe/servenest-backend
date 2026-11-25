import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Used so login takes the same time whether or not the email exists
export const DUMMY_HASH = bcrypt.hashSync("servenest-dummy-password", ROUNDS);