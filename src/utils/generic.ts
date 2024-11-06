export const getRandomNumber = (min = 0, max = 1) => (Math.random() * (max - min) + min) | 0;
