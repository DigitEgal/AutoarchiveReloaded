/*
Copyright 2018 Brummolix (AutoarchiveReloaded, https://github.com/Brummolix/AutoarchiveReloaded )

 This file is part of AutoarchiveReloaded.

    AutoarchiveReloaded is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    AutoarchiveReloaded is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with AutoarchiveReloaded.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");

function startup(data, reason) {
	console.log("AutoArchiveReloaded - startup");

    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   APP_STARTUP
    ///   ADDON_ENABLE
    ///   ADDON_INSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE

	Components.utils.import("chrome://autoarchiveReloaded/content/options.js");

	var browserWebExtension;
	if (data.webExtension)
	{
		data.webExtension.startup().then(api => {
			const {browser} = api;
			browserWebExtension = browser;
		    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
				if (msg.id == "sendCurrentPreferencesToLegacyAddOn") //we get the current preferences at start and on every change of preferences
				{
					AutoarchiveReloadedOptions.settings = msg.data;
				}
				else if (msg.id == "askForLegacyPreferences") //at startup we are asked for legacy preferences
				{
					sendReply({data: AutoarchiveReloadedOptions.getLegacyOptions()}); 
					AutoarchiveReloadedOptions.markLegacySettingsAsMigrated();
				}
				else if (msg.id == "webExtensionStartupDone") //after startup we are informed and can go on
				{
					initAutoArchiveReloadedOverlay();
				}
			});
		});
	}
}

function initAutoArchiveReloadedOverlay()
{
	Components.utils.import("chrome://autoarchiveReloaded/content/overlay.js");
	Components.utils.import("chrome://autoarchiveReloaded/content/thunderbird-stdlib/RestartlessMenuItems.js");

	//menuitem
	//TODO: muss das eigentlich bei install gemacht werden oder bei startup?
	RestartlessMenuItems.add({
		label: AutoarchiveReloadedOverlay.StringBundle.GetStringFromName("menuArchive"),
		id: "AutoArchiveReloaded_AutoarchiveNow",
		onCommand: function () 
		{
			AutoarchiveReloadedOverlay.Global.onArchiveManually();
		},
		onUnload: function () {}
	});

	//TODO: Toolbar in alle Windows einhängen...
	//TODO: wahrscheinlich besser so:
	//https://github.com/dgutov/bmreplace/blob/67ad019be480fc6b5d458dc886a2fb5364e92171/bootstrap.js#L27

	//toolbar button
	//see https://gist.github.com/Noitidart/9467045
	/*
	var doc = document;
	var toolbox = doc.querySelector('#navigator-toolbox');
	
	var buttonId = 'AutoArchiveReloaded_AutoarchiveNow_Button';
	var button = doc.getElementById(buttonId);
	if (!button) 
	{
		button = doc.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'toolbarbutton');
		button.setAttribute('id', buttonId);
		button.setAttribute('label', AutoarchiveReloadedOverlay.StringBundle.GetStringFromName("menuArchive"));
		button.setAttribute('tooltiptext', 'TODO My buttons tool tip if you want one');
		button.setAttribute('class', 'toolbarbutton-1 chromeclass-toolbar-additional');
		button.style.listStyleImage = 'url("https://gist.githubusercontent.com/Noitidart/9266173/raw/06464af2965cb5968248b764b4669da1287730f3/my-urlbar-icon-image.png")';
		button.addEventListener('command', function() {
			AutoarchiveReloadedOverlay.Global.onArchiveManually();
		}, false);

		toolbox.palette.appendChild(button);
	}			
	//move button into last postion in nav-bar
	var navBar = doc.querySelector('#nav-bar');
	navBar.insertItem(buttonId); //if you want it in first position in navBar do: navBar.insertItem(buttonId, navBar.firstChild);
	navBar.removeChild(button);			
	*/
	
	//startup
	AutoarchiveReloadedOverlay.Global.startup();
}

function shutdown(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   APP_SHUTDOWN
    ///   ADDON_DISABLE
    ///   ADDON_UNINSTALL
    ///   ADDON_UPGRADE
	///   ADDON_DOWNGRADE

	console.log("AutoArchiveReloaded - shutdown");

	if (RestartlessMenuItems)
		RestartlessMenuItems.removeAll();

	Components.utils.unload("chrome://autoarchiveReloaded/content/overlay.js");
	Components.utils.unload("chrome://autoarchiveReloaded/content/thunderbird-stdlib/RestartlessMenuItems.js");
	Components.utils.unload("chrome://autoarchiveReloaded/content/options.js");
}

function install(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   ADDON_INSTALL
    ///   ADDON_UPGRADE
    ///   ADDON_DOWNGRADE
	
	console.log("AutoArchiveReloaded - install");
}

function uninstall(data, reason) {
    /// Bootstrap data structure @see https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_data
    ///   string id
    ///   string version
    ///   nsIFile installPath
    ///   nsIURI resourceURI
    /// 
    /// Reason types:
    ///   ADDON_UNINSTALL
    ///   ADDON_UPGRADE
	///   ADDON_DOWNGRADE
	
	console.log("AutoArchiveReloaded - uninstall");
}