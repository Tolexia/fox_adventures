// Fonction de bruit personnalisée
const noise = (nx, nz) => {
    // Plusieurs octaves de bruit pour plus de détails
    let e = 1.0;
    let n = 0.0;
    
    // Première octave - relief principal
    n += e * Math.sin(nx * 3.0) * Math.cos(nz * 3.0);
    e *= 0.5;
    
    // Deuxième octave - collines moyennes
    n += e * Math.sin(nx * 6.0) * Math.cos(nz * 6.0);
    e *= 0.5;

    // Troisième octave - petits détails
    n += e * Math.sin(nx * 12.0) * Math.cos(nz * 12.0);
    e *= 0.5;

    // Quatrième octave - micro-relief
    n += e * Math.sin(nx * 24.0) * Math.cos(nz * 24.0);

    // Normaliser entre 0 et 1
    return (n + 1.0) * 0.5;
}

export default noise;