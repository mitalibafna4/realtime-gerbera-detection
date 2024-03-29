$(function () {
    const video = $("video")[0];
    const sidebar = $("<div/>").addClass("sidebar").appendTo("body");
    const leftSidebar = $("<div/>").addClass("left-sidebar").appendTo(sidebar);
    const rightSidebar = $("<div/>").addClass("right-sidebar").appendTo(sidebar);

    const currentTable = $("<table/>").addClass("table").appendTo(leftSidebar);
    const historicalTable = $("<table/>").addClass("historical-data-table").appendTo(rightSidebar);

    const historicalData = []; // Array to store historical data

    var model;
    var cameraMode = "environment"; // or "user"
    var detectedColors = {}; // Object to store detected colors and their counts
    var countedObjects = {}; // Object to track counted objects in the current frame
    var isDetectionRunning = true; // Flag to track if detection is running

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    var publishable_key = "rf_r1XRnw8GiggFk70RZbCYagg3hiX2";
    var toLoad = {
        model: "kkwagh-group15",
        version: 1
    };

    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        // Ratio of the video's intrinsic dimensions
        var videoRatio = video.videoWidth / video.videoHeight;

        // The width and height of the video element
        var width = video.offsetWidth,
            height = video.offsetHeight;

        // The ratio of the element's width to its height
        var elementRatio = width / height;

        // If the video element is short and wide
        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            // It must be tall and thin, or exactly equal to the original ratio
            height = width / videoRatio;
        }

        return {
            width: width,
            height: height
        };
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        canvas[0].width = video.videoWidth;
        canvas[0].height = video.videoHeight;

        canvas.css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);

        var scale = 1;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        detectedColors = {}; // Reset detected colors for each frame

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            const color = prediction.class; // Get the detected color

            // Increment count for this color
            if (!detectedColors[color]) {
                detectedColors[color] = 1;
            } else {
                detectedColors[color]++;
            }

            // Draw the bounding box.
            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                width / scale,
                height / scale
            );

            // Draw the label background.
            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10); // base 10
            ctx.fillRect(
                (x - width / 2) / scale,
                (y - height / 2) / scale,
                textWidth + 8,
                textHeight + 4
            );
        });

        // Update the count in the sidebar
        updateSidebarCount();

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;

            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the text last to ensure it's on top.
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(
                prediction.class,
                (x - width / 2) / scale + 4,
                (y - height / 2) / scale + 1
            );
        });
    };

    const updateSidebarCount = function () {
        const flowerCounts = {
            'dark pink': 0,
            'gerbera': 0,
            'not grown': 0,
            'orange': 0,
            'pink': 0,
            'red': 0,
            'salmon': 0,
            'white': 0,
            'yellow': 0
        };
    
        // Update counts only for newly detected objects
        Object.keys(detectedColors).forEach(color => {
            if (detectedColors[color] > (countedObjects[color] || 0)) {
                flowerCounts[color] = detectedColors[color] - (countedObjects[color] || 0);
                countedObjects[color] = detectedColors[color];
            }
        });
    
        // Update the sidebar with the latest counts
        updateSidebar(flowerCounts);
    
        // Save historical data
        const timestamp = new Date().toLocaleString();
        historicalData.push({ timestamp, counts: { ...flowerCounts } });
    
        // Display historical data in the right sidebar
        displayHistoricalData();
    };
    

    const updateSidebar = function (flowerCounts) {
        currentTable.empty(); // Clear previous counts

        const headerRow = $("<tr/>");
        $("<th/>").text("Color").appendTo(headerRow);
        $("<th/>").text("Count").appendTo(headerRow);
        currentTable.append(headerRow);

        for (const [color, count] of Object.entries(flowerCounts)) {
            const row = $("<tr/>");
            $("<td/>").text(color).appendTo(row);
            $("<td/>").text(count).appendTo(row);
            currentTable.append(row);
        }
    };

    const displayHistoricalData = function () {
        historicalTable.empty(); // Clear previous historical data
    
        const headerRow = $("<tr/>");
        $("<th/>").text("Timestamp").appendTo(headerRow);
        $("<th/>").text("Color").appendTo(headerRow);
        $("<th/>").text("Count").appendTo(headerRow);
        historicalTable.append(headerRow);
    
        const colorsToDisplay = ['dark pink', 'gerbera', 'not grown', 'orange', 'pink', 'red', 'salmon', 'white', 'yellow'];
    
        const historicalCounts = {}; // Object to store historical counts for specified colors
        let totalCount = 0; // Variable to store total count
    
        historicalData.forEach((record) => {
            const timestamp = record.timestamp;
            const counts = record.counts;
    
            for (const color of colorsToDisplay) {
                if (!(color in historicalCounts)) {
                    historicalCounts[color] = 0;
                }
    
                historicalCounts[color] += counts[color] || 0;
                totalCount += counts[color] || 0;
            }
        });
    
        colorsToDisplay.forEach((color) => {
            const row = $("<tr/>");
            $("<td/>").text("Total").appendTo(row);
            $("<td/>").text(color).appendTo(row);
            $("<td/>").text(historicalCounts[color] || 0).appendTo(row); // Display count for specified color
            historicalTable.append(row);
        });
    
        // Add total count row at the end
        const totalRow = $("<tr/>");
        $("<td/>").text("Total").appendTo(totalRow);
        $("<td/>").text("All Colors").appendTo(totalRow);
        $("<td/>").text(totalCount).appendTo(totalRow);
        historicalTable.append(totalRow);
    };
    

    const generateExcelFile = function () {
        let csv = "Timestamp,Color,Count\n";

        historicalData.forEach((record) => {
            const timestamp = record.timestamp;
            const counts = record.counts;

            Object.entries(counts).forEach(([color, count]) => {
                csv += `${timestamp},${color},${count}\n`;
            });
        });

        const csvContent = "data:text/csv;charset=utf-8," + csv;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "flower_counts_history.csv");
        document.body.appendChild(link);
        link.click();
    };

    const detectFrame = function () {
        if (!model) return requestAnimationFrame(detectFrame);

        model
            .detect(video)
            .then(function (predictions) {
                if (isDetectionRunning) {
                    requestAnimationFrame(detectFrame);
                    renderPredictions(predictions);
                }
            })
            .catch(function (e) {
                console.log("Error detecting frame:", e);
                if (isDetectionRunning) {
                    requestAnimationFrame(detectFrame);
                }
            });
    };

    $("#downloadReport").click(function () {
        generateExcelFile();
    });

    $("#cancelDetection").click(function () {
        console.log("Detection canceled.");
        isDetectionRunning = false;
        // Additional actions for canceling detection can be added here
    });
    
});
