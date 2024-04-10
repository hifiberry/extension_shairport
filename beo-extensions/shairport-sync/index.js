// SHAIRPORT-SYNC (AIRPLAY) INTEGRATION FOR BEOCREATE
const { updateAttribValueConfig, 
	getExtensionStatus, 
	setExtensionStatus,
	restartExtension } = 
require(global.beo.extensionDirectory+'/hbosextensions/utilities');


var fs = require("fs");

var debug = beo.debug;
var version = require("./package.json").version;

var shairportSyncVersion = null;
var configuration = {};

var shairportSyncEnabled = false;
var sources = null;

var defaultSettings = {
	"syncVolume": false
};
var settings = JSON.parse(JSON.stringify(defaultSettings));

hbosextensionName = "shairport"
shairportsyncconfig = {}
const configfile="/etc/shairport-sync.conf"

beo.bus.on('general', function (event) {

	if (event.header == "startup") {

		if (beo.extensions.sources &&
			beo.extensions.sources.setSourceOptions &&
			beo.extensions.sources.sourceDeactivated) {
			sources = beo.extensions.sources;
		}

        if (sources) {
            getExtensionStatus(hbosextensionName, function(enabled) {
                sources.setSourceOptions("shairport-sync", {
                    enabled: enabled,
                    transportControls: true,
                    usesHifiberryControl: true,
                    aka: ["ShairportSync"]
                });
            });
        }

	}

	if (event.header == "activatedExtension") {
		if (event.content.extension == "shairport-sync") {
			shairportsyncconfig=parseConfigFile(configfile);
			try {
				ssncPassword = (shairportsyncconfig.general.password) ? true : false;
			} catch (error) {
				console.error('An error occurred while checking for shairportsyncconfig.general.password:', error);
				ssncPassword = false ; // Set ssncPassword to false if an error occurs
			}

			beo.bus.emit("ui", {
				target: "shairport-sync", header: "configuration",
				content: {
					usesPassword: ssncPassword,
					shairportSyncEnabled: shairportSyncEnabled
				}
			});

		}
	}
});


beo.bus.on('product-information', function (event) {

	if (event.header == "systemNameChanged") {
		// Listen to changes in system name and update the shairport-sync display name.
		if (event.content.systemName) {
			configureShairportSync("general", "name", event.content.systemName);
		}

	}


});

beo.bus.on('shairport-sync', function (event) {

	if (event.header == "settings") {
		if (event.content.settings) {
			settings = Object.assign(settings, event.content.settings);
		}
	}

	if (event.header == "setPassword") {
		// If password field is set, change password. Otherwise remove it.
		if (event.content.password != false) {
			configureShairportSync(configfile, shairportsyncconfig, "general", "password", event.content.password)
		} else {
			configureShairportSync(configfile, shairportsyncconfig, "general", "password", null)
		}

		beo.bus.emit("ui", { target: "shairport-sync", header:"configuration", content: { usesPassword: event.content.password != false } });

		restartExtension(hbosextensionName, (success) => {
			if (! success) {
			  console.error("Failed to restart the service:", error);
			  beo.bus.emit("ui", { target: "shairport-sync", header: "serviceRestartError" });
			  return;
			}

			console.log("Service restarted successfully.");
		  });	

	}

	if (event.header == "shairportSyncEnabled") {
		if (event.content.enabled !== undefined) {
		  setExtensionStatus(hbosextensionName, event.content.enabled, function(newStatus, error) {
			// Emit updated settings to UI
			beo.bus.emit("ui", {target: "shairport-sync", header: "configuration", content: {"shairportSyncEnabled": event.content.enabled}});
	
			// Update source options based on new status
			if (sources) sources.setSourceOptions("shairport-sync", {enabled: event.content.enabled});
	
			// Handle deactivation
			if (event.content.enabled === false) {
			  if (sources) sources.sourceDeactivated("shairport-sync");
			}
	
			// Handle errors
			if (error) {
			  beo.bus.emit("ui", {target: "shairport-sync", header: "errorTogglingShairportSync", content: {}});
			}
		  });
		}
	  }
	  

});

function parseConfigFile(filePath) {
    // Read file content synchronously
    let configString;
    try {
        configString = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error("Error reading the file:", error);
        return null;
    }

    // Parse the content
    const configSections = configString.split('}\n');
    let configObject = {};

    configSections.forEach(section => {
        if (section.trim() === '') return;
        const sectionParts = section.split('=\n{');
        if (sectionParts.length < 2) return; // Skip if the section is not properly formatted

        const sectionName = sectionParts[0].trim();
        const properties = sectionParts[1].trim().split('\n').filter(line => line.trim() !== '');

        configObject[sectionName] = {};

        properties.forEach(property => {
            // Check if property contains '=' to split into key-value
            if (!property.includes('=')) return;
            
            let [key, value] = property.split('=').map(part => part.trim());
            if (value) { // Check if value is defined
                value = value.replace(';', '').trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (!isNaN(parseFloat(value))) {
                    value = parseFloat(value);
                }
                configObject[sectionName][key] = value;
            }
        });
    });

    return configObject;
}



function configureShairportSync(filePath, configObject, sectionName, optionName, newValue) {
    // Check if the configObject is empty
    if (Object.keys(configObject).length === 0) {
        console.log("The configuration object is empty. No changes will be made.");
        return;
    }

    // Modify the configuration object
    if (configObject[sectionName]) {
        if (newValue === null) {
            // Remove the option if newValue is null
            delete configObject[sectionName][optionName];
        } else {
            // Update or add the option with the new value
            configObject[sectionName][optionName] = newValue;
        }
    } else {
        console.error(`Section "${sectionName}" not found.`);
        // Optionally, add the section if it does not exist and newValue is not null
        // This is commented out by default, uncomment if you want this behavior
        // if (newValue !== null) {
        //     configObject[sectionName] = { [optionName]: newValue };
        // }
        return;
    }

    // Convert the updated configuration object back into a string format
    let updatedConfigString = '';
    for (const [section, options] of Object.entries(configObject)) {
        updatedConfigString += `${section} =\n{\n`;
        for (const [option, value] of Object.entries(options)) {
            let formattedValue = typeof value === 'string' ? `"${value}"` : value;
            updatedConfigString += `    ${option} = ${formattedValue};\n`;
        }
        updatedConfigString += `}\n`;
    }

    // Write the updated configuration back to the file
    try {
        fs.writeFileSync(filePath, updatedConfigString.trim() + '\n'); // Ensure file ends with a newline
        console.log("Configuration updated successfully.");
    } catch (error) {
        console.error("Error writing the updated configuration to the file:", error);
    }
}


module.exports = {
	version: version,
};
