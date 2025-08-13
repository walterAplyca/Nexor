export const jwtConstants = {
    get JWT_SECRET() {
        return process.env.JWT_SECRET;
    },
    get JWT_EXPIRES_IN() {
        return process.env.JWT_EXPIRES_IN;
    }
};