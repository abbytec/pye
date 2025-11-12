const buffer = new Uint8Array(1);
export function generateRandomNumber(){
    crypto.getRandomValues(buffer);
    return buffer[0];
}

export function generateRandomBinary(){
    crypto.getRandomValues(buffer);
    return buffer[0] % 2;
}

export function generateRandomBoolean(){
    crypto.getRandomValues(buffer);
    return !(buffer[0] % 2);
}