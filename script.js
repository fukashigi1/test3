import DeviceDetector from "https://cdn.skypack.dev/device-detector-js@2.2.10";

const mpHands = window;
const drawingUtils = window;
const controls = window;
const controls3d = window;
// Our input frames will come from here.
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
const canvasCtx = canvasElement.getContext('2d');
const coordenadas = document.getElementById('coordenadas');

const config = { locateFile: (file) => { //esta wea llama al modelo de entrenamiento hand_landmarker.task
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${mpHands.VERSION}/${file}`;
} };

// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
const fpsControl = new controls.FPS();
// Optimization: Turn off animated spinner after its hiding animation is done.
const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];

const grid = new controls3d.LandmarkGrid(landmarkContainer, {
    connectionColor: 0xCCCCCC,
    definedColors: [{ name: 'Left', value: 0xffa500 }, { name: 'Right', value: 0x00ffff }],
    range: 0.2,
    fitToGrid: true,
    landmarkSize: 2,
    numCellsPerAxis: 4,
    showHidden: false,
    centered: true,
});

function extractData(landmarks){
    //ESTA FUNCION TRANSFORMA LOS DATOS DE OBJETO A FLOATS, SE ALMACENA TODO EN LA LISTA
    //VALORES, LA CUAL CONTIENE 63 ELEMENTOS (X, Y ,Z * 3)

    const scaleFactor = 100; //Variable para ajustar la escala de las coordenadas
    var transformed = JSON.stringify(landmarks) //se transforma de objeto a string.
    //De aquí para abajo se quitan todos los caractere especiales como, {[":,.
    var output = transformed.replace(/[\[\]{}]/g, '');
    output = output.replace(/"|x|y|z|:/g, '');
    output = output.replace(/,/g, ' ');
    //Se separa el string con los 21 datos en una lista.
    var valores = output.split(' ')
    //Se trunca cada numero por 6 decimales, (dice 8 porque en realidad se está cortando un string)
    //Se transforma cada elemento de la lista (strings) en flotantes.
    valores = valores.map(function(elemento) {
      return parseFloat(elemento)
    });
    const valoresEscalados = valores.map((valor) => (valor * scaleFactor).toFixed(6)); //se escala por 100 y se corta en 6 decimales.
    const valoresPlanos = valoresEscalados.flat().map(Number);; //Transformamos todo a un array plano
    coordenadas.innerHTML = valoresPlanos //<-- Se muestra a tiempo real dentro del h1 en el html.
    console.log(valoresPlanos)
}

function onResults(results) {
    // Update the frame rate.
    fpsControl.tick();
    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let index = 0; index < results.multiHandLandmarks.length; index++) {
            const classification = results.multiHandedness[index];
            const isRightHand = classification.label === 'Right';
            const landmarks = results.multiHandLandmarks[index];

            //console.log(results.multiHandLandmarks[index]);

            //extractData(landmarks)

            drawingUtils.drawConnectors(canvasCtx, landmarks, mpHands.HAND_CONNECTIONS, { color: isRightHand ? '#00FF00' : '#FF0000' });
            drawingUtils.drawLandmarks(canvasCtx, landmarks, {
                color: isRightHand ? '#00FF00' : '#FF0000',
                fillColor: isRightHand ? '#FF0000' : '#00FF00',
                radius: (data) => {
                    return drawingUtils.lerp(data.from.z, -0.15, .1, 10, 1);
                }
            });
        }
    }
    canvasCtx.restore();
    if (results.multiHandWorldLandmarks) {
        // We only get to call updateLandmarks once, so we need to cook the data to
        // fit. The landmarks just merge, but the connections need to be offset.
        const landmarks = results.multiHandWorldLandmarks.reduce((prev, current) => [...prev, ...current], []);

        const colors = [];
        let connections = [];
        for (let loop = 0; loop < results.multiHandWorldLandmarks.length; ++loop) {
            const offset = loop * mpHands.HAND_CONNECTIONS.length;
            const offsetConnections = mpHands.HAND_CONNECTIONS.map((connection) => [connection[0] + offset, connection[1] + offset]);
            connections = connections.concat(offsetConnections);
            const classification = results.multiHandedness[loop];
            colors.push({
                list: offsetConnections.map((unused, i) => i + offset),
                color: classification.label,
            });
        }
        extractData(landmarks)
        grid.updateLandmarks(landmarks, connections, colors);
    }
    else {
        grid.updateLandmarks([]);
    }
}

const hands = new mpHands.Hands(config);
hands.onResults(onResults);
new controls
    .ControlPanel(controlsElement, {
    selfieMode: true,
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.5
})
    .add([
    new controls.StaticText({ title: 'Motion Pose' }),
    fpsControl,
    new controls.SourcePicker({
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height;
            await hands.send({ image: input });
        },
    }),
    new controls.Slider({
        title: 'Complejidad del modelo',
        field: 'modelComplexity',
        discrete: ['Minima', 'Completa'],
    }), 
    new controls.Slider({
        title: 'Confidencia de detección',
        field: 'minDetectionConfidence',
        range: [0, 1],
        step: 0.01
    }),
    new controls.Slider({
        title: 'Confidencia de seguimiento',
        field: 'minTrackingConfidence',
        range: [0, 1],
        step: 0.01
    }),
])
    .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    hands.setOptions(options);
});