function getFileType() {
    var fileName = document.getElementById("filename");

    if (fileName.files.length == 0) {
        return;
    }

    if (fileName.files[0].type == "application/json") {
        document.getElementById("fileTypeJSON").checked = true;
    } else {
        document.getElementById("fileTypeCSV").checked = true;
    }
}

function anonymize() {
    var fileName = document.getElementById("filename");

    if (fileName.files.length == 0) {
        alert("Please select file to anonymize");
        return;
    }

    getFileContent(fileName, (text) => {
        document.getElementById("sourceArea").value = text;

        doAnonymize(text);
    })
}

function getFileContent(fileName, onload) {
    var reader = new FileReader();
    reader.onload = function(){
        var text = reader.result;
        onload(text);
    };
    reader.onerror = function(){
        alert("error");
    }

    reader.readAsText(filename.files[0]);
}

function writeFile(content, filename, mimeType) {
    var a = document.createElement("a");
    var file = new Blob([content.replace(/\n/g, "\n\n")], {type:  mimeType});
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
}

function doAnonymize(text) {
    if (text == null) {
        return;
    }

    writeStatus("Processing...");

    var fileTypeElements = document.getElementsByName("fileType");
    var fileType = "csv";
    for (i=0; i<fileTypeElements.length; i++) {
        if (fileTypeElements[i].checked) {
            fileType = fileTypeElements[i].value;
            break;
        }
    }

    var keysToAnonymize = document.getElementById("keys").value.split(",");
    
    // build conversion map
    var conversionMap = {}

    var result = "";
    if (fileType == "csv") {
        result = anonymizeCSV(keysToAnonymize, conversionMap, text);        
    } else {
        result = anonymizeJSON(keysToAnonymize, conversionMap, text);        
    }

    if (result == "Error") {
        writeStatus("Failed. got error");
        return;
    }

    writeFile(result, "output.txt", "plain/text");

    document.getElementById("resultArea").value = result;

    writeConversionMap(keysToAnonymize, conversionMap);

    writeStatus("Completed.");
}

function anonymizeCSV(keysToAnonymize, conversionMap, text) {
    var textLines = text.split("\n");
    var result = "";
    for (i=0; i<textLines.length; i+=1) {
        if ((i % 100) == 0) {
            writeStatus("Processing line " + i + " of " + textLines.length);
        }

        if (textLines[i].trim() == "") {
            continue;
        }

        var cols = textLines[i].split(",");

        var line = "";
        for (col=0; col<cols.length; col+=1) {
            if (line != "") {
                line += ",";
            }

            var value = cols[col];

            value = anonymizeValue(conversionMap, value.trim());

            line += value;
        }

        result += line + "\n";
    }

    return result;
}

function anonymizeJSON(keysToAnonymize, conversionMap, text) {
    var docJSON = JSON.parse(text);

    for (key=0; key<keysToAnonymize.length; key+=1) {
        var keyToAnonymize = keysToAnonymize[key].split(".");

        if (!anonymizeJSONKey(conversionMap, keyToAnonymize, 0, docJSON)) {
            return "Error";
        }
    }

    var result = JSON.stringify(docJSON, 2);

    return result;
}

function anonymizeJSONKey(conversionMap, keyToAnonymize, keyPart, json) {
    if (keyPart >= keyToAnonymize.length) {
        return false;
    }

    var keyJSON = json[keyToAnonymize[keyPart]];

    if (keyJSON == null) {
        alert("Keys to anonymize doesn't match data file JSON structure: " + keyToAnonymize);
        return false;
    }

    // last part - annonymize value
    if (keyPart == (keyToAnonymize.length-1)) {

        // array of keys to annonymize
        if (Array.isArray(keyJSON)) {
            for (i=0; i<keyJSON.length; i+=1) {
                if (typeof keyJSON[i] == "object") {
                    alert("Keys to anonymize doesn't match data file JSON structure: " + keyToAnonymize);
                    return false;
                } else {
                    keyJSON[i] = anonymizeValue(conversionMap, keyJSON[i].trim());
                }
            }

            return true;
        }

        if (typeof keyJSON == "object") {
            alert("Keys to anonymize doesn't match data file JSON structure: " + keyToAnonymize);
            return false;
        } 

        json[keyToAnonymize[keyPart]] = anonymizeValue(conversionMap, keyJSON.trim());

        return true;
    }

    if (Array.isArray(keyJSON)) {
        for (i=0; i<keyJSON.length; i+=1) {
            if (!anonymizeJSONKey(conversionMap, keyToAnonymize, keyPart+1, keyJSON[i])) {
                return false;
            }
        }

        return true;
    } else {
        return anonymizeJSONKey(conversionMap, keyToAnonymize, keyPart+1, keyJSON);
    }
}

function anonymizeValue(conversionMap, value) {
    var hashValue = conversionMap[value];
    if (hashValue != null) {
        return hashValue;
    }

    hashValue = Math.trunc(Math.random() * 10000000);
    conversionMap[value] = hashValue;
    return hashValue;
}

function writeConversionMap(keysToAnonymize, conversionMap) {
    var result = { "conversionMap" : conversionMap };

    var resultText = "";
    for(var key in conversionMap) {
        var value = conversionMap[key];
        resultText += key + " => " + value + "\n";
    }

    resultText += "\n";

    writeFile(JSON.stringify(result), "conversionMap.txt", "application/json");

    document.getElementById("conversionMap").value = resultText;
}

function writeStatus(message) {
    var status = document.getElementById("status");
    
    status.value = message;
    status.style.display = 'none';
    status.style.display = 'block';
}
