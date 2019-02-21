/*!
Copyright 2013-2018 Brummolix (new version AutoarchiveReloaded, https://github.com/Brummolix/AutoarchiveReloaded )
Copyright 2012 Alexey Egorov (original version Autoarchive, http://code.google.com/p/autoarchive/ )

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

//TODO: remove
AutoarchiveReloadedWebextension.loggerWebExtension.info("Hello world overlay.ts");

// tslint:disable-next-line:no-var-keyword
var EXPORTED_SYMBOLS = ["AutoarchiveReloadedBootstrap"];

//Cu.import("resource://gre/modules/Services.jsm");
//Cu.import("resource://gre/modules/AddonManager.jsm");
//Cu.import("resource://gre/modules/FileUtils.jsm");
//Cu.import("resource://gre/modules/NetUtil.jsm");
//Cu.import("resource://gre/modules/Timer.jsm");
//Cu.import("resource:///modules/iteratorUtils.jsm");

//Attention, if you addd more scripts also add them to bootstrap.ts for propper unloading!
//Cu.import("chrome://autoarchiveReloaded/content/helper.js");
//Cu.import("chrome://autoarchiveReloaded/content/shared/Logger.js");
//Cu.import("chrome://autoarchiveReloaded/content/thunderbird-stdlib/msgHdrUtils.js");

namespace AutoarchiveReloadedBootstrap
{
	//singleton with global helper
	export class Helper
	{
		public static getMail3Pane(): Mail3Pane
		{
			return Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator)
				.getMostRecentWindow("mail:3pane");
		}

		public static alert(message: string): void
		{
			//TODO: alert() is not supported in background windows; please use console.log instead.
			alert(message);
		}

		public static confirm(message: string): boolean
		{
			//TODO: confirm wird im Background Window nicht gehen!
			return confirm(message);
		}

		public static messageHasTags(msgDbHeader: Ci.nsIMsgDBHdr): boolean
		{
			const tags = msgHdrGetTags(msgDbHeader);
			return (tags && tags.length > 0);
		}

		public static messageGetAgeInDays(msgDbHeader: Ci.nsIMsgDBHdr): number
		{
			const now = new Date();
			const ageInSeconds = (now.getTime() / 1000) - msgDbHeader.dateInSeconds;
			const ageInDays = ageInSeconds / (60 * 60 * 24);
			return ageInDays;
		}
	}

	//-----------------------------------------------------------------------------------------------------

	//TODO: LegacyExtensionLoggerHelper supported filelogging? is it still possible?
	//TODO: getEnableInfoLogging came from settings?

	/*
	class LegacyExtensionLoggerHelper implements AutoarchiveReloadedShared.ILoggerHelper
	{
		private readonly consoleService: Ci.nsIConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

		public log(msgToLog: string): void
		{
			this.consoleService.logStringMessage(msgToLog);
			this.writeToFile(msgToLog);
		}

		public getEnableInfoLogging(): boolean
		{
			if (AutoarchiveReloadedBootstrap.settings && AutoarchiveReloadedBootstrap.settings.globalSettings && AutoarchiveReloadedBootstrap.settings.globalSettings !== undefined)
			{
				return AutoarchiveReloadedBootstrap.settings.globalSettings.enableInfoLogging;
			}

			return false;
		}

		private writeToFile(str: string): void
		{
			try
			{
				//see https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O

				// get file in the profile directory ("ProfD")
				const file = FileUtils.getFile("ProfD", ["AutoarchiveReloadedLog.txt"]);

				const foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

				// tslint:disable-next-line:no-bitwise
				foStream.init(file, 0x02 | 0x08 | 0x10, -1, 0); //-1 = default 0664, but 0664 does not work, maybe 664...

				const converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
				converter.init(foStream, "UTF-8", 0, 0);
				converter.writeString(str + "\r\n");
				converter.close(); // this closes foStream
			}
			catch (e)
			{
				Application.console.log("error writing to log file " + AutoarchiveReloadedShared.Logger.getExceptionInfo(e));
				//trotzdem weitermachen, ist ja nur logging...
			}
		}
	}
	*/

	//------------------------------------------------------------------------------

	//for managing the activities in activity view
	class ActivityManager
	{
		private folder: Ci.nsIMsgFolder;
		private startProcess: Ci.nsIActivityProcess;

		constructor(folder: Ci.nsIMsgFolder)
		{
			try
			{
				this.folder = folder;
				this.startProcess = Components.classes["@mozilla.org/activity-process;1"].createInstance(Components.interfaces.nsIActivityProcess);

				this.startProcess.init(browser.i18n.getMessage("activityStart", this.folder.name), null);
				this.startProcess.contextType = "account"; // group this activity by account
				this.startProcess.contextObj = this.folder.server; // account in question

				const activityManager = this.getActivityManager();
				activityManager.addActivity(this.startProcess);
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		public stopAndSetFinal(actual: number): void
		{
			try
			{
				this.startProcess.state = Components.interfaces.nsIActivityProcess.STATE_COMPLETED;
				const activityManager = this.getActivityManager();
				activityManager.removeActivity(this.startProcess.id);

				let msgNumber: string;
				if (actual < 0)
				{
					msgNumber = "? (error occured)";
				}
				else
				{
					msgNumber = actual.toString();
				}

				const event = Components.classes["@mozilla.org/activity-event;1"].createInstance(Components.interfaces.nsIActivityEvent);
				event.init(browser.i18n.getMessage("activityDone", this.folder.name),
					null,
					browser.i18n.getMessage("activityMessagesToArchive", msgNumber),
					this.startProcess.startTime, // start time
					Date.now(), // completion time
				);
				event.contextType = this.startProcess.contextType; // optional
				event.contextObj = this.startProcess.contextObj; // optional
				activityManager.addActivity(event);
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		private getActivityManager(): Ci.nsIActivityManager
		{
			return Components.classes["@mozilla.org/activity-manager;1"].getService(Components.interfaces.nsIActivityManager);
		}
	}

	//-------------------------------------------------------------------------------------

	//for collecting the searched mails and start real archiving
	class SearchListener
	{
		private messages: Ci.nsIMsgDBHdr[] = [];
		private folder: Ci.nsIMsgFolder;
		private activity: ActivityManager;
		private settings: IAccountSettings;
		private onFolderArchivedEvent: () => void;

		constructor(folder: Ci.nsIMsgFolder, activity: ActivityManager, settings: IAccountSettings, onFolderArchivedEvent: () => void)
		{
			this.folder = folder;
			this.activity = activity;
			this.settings = settings;
			this.onFolderArchivedEvent = onFolderArchivedEvent;
		}

		public archiveMessages(): number
		{
			try
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("start real archiving of '" + this.folder.name + "' (" + this.messages.length + " messages)");
				const mail3PaneWindow: Mail3Pane = Helper.getMail3Pane();

				//TB jumps to the end (after finishing the archiving) if no message is selected
				//> select the first message (unfortunately it will become unread...)
				//(but only select the first message if the messages being archived are from the current folder)
				if (this.messages.length > 0)
				{
					if (this.messages[0].folder === mail3PaneWindow.gFolderDisplay.displayedFolder)
					{
						if (mail3PaneWindow.gFolderDisplay.selectedCount <= 0)
						{
							mail3PaneWindow.gFolderDisplay.navigate(Components.interfaces.nsMsgNavigationType.firstMessage);
						}
					}
				}

				const batchMover: Ci.BatchMessageMover = new mail3PaneWindow.BatchMessageMover();

				//There are several issues with "this.view.dbView is null" inside "chrome://messenger/content/folderDisplay.js", 1359
				//see https://github.com/Brummolix/AutoarchiveReloaded/issues/1
				//see https://github.com/Brummolix/AutoarchiveReloaded/issues/5
				//see https://github.com/Brummolix/AutoarchiveReloaded/issues/7
				//something is wrong inside the TB stuff at this moment
				//the null pointer exception is described here: https://bugzilla.mozilla.org/show_bug.cgi?id=978559 but the Mozilla guys have not done anything about it until now
				//
				//one reason is, if no folder is selected (for example if the account is selected only)
				//therefore we try to select some folder if we find the dbView is null
				if (mail3PaneWindow.gFolderDisplay)
				{
					if (mail3PaneWindow.gFolderDisplay.view)
					{
						if (!mail3PaneWindow.gFolderDisplay.view.dbView)
						{
							AutoarchiveReloadedWebextension.loggerWebExtension.info("mail3PaneWindow.gFolderDisplay.dbView is null > batchMessageMover will not work");
							const folderToSelect = this.folder;
							if (folderToSelect)
							{
								AutoarchiveReloadedWebextension.loggerWebExtension.info("> try to select folder " + folderToSelect.name + " " + folderToSelect.URI);
								//When extension TorBirdy was installed gFolderTreeView.selectFolder did not work.
								//gFolderDisplay.show worked with and without TorBirdy.
								mail3PaneWindow.gFolderDisplay.show(folderToSelect);
							}
						}
					}
				}

				//TODO: do not archive if a imap server is offline (otherwise the archive is done locally but not on the server, if you start next time (and you are online) it may be archived again
				//-> problem: how to detect imap server problems/problems with i-net connection? (we do not talk about online/offline mode here which you can handle with  MailOfflineMgr!)
				//I have also reported the real bug to TB: see https://bugzilla.mozilla.org/show_bug.cgi?id=956598

				batchMover.archiveMessages(this.messages);
				return this.messages.length;
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				return -1;
			}
		}

		//collect all messages
		public onSearchHit(dbHdr: Ci.nsIMsgDBHdr, folder: Ci.nsIMsgFolder): void
		{
			try
			{
				//determine ageInDays
				let ageInDays = 0;
				let other = true;

				//unread
				if (!dbHdr.isRead)
				{
					if (!this.settings.bArchiveUnread)
					{
						return;
					}

					other = false;
					ageInDays = Math.max(ageInDays, this.settings.daysUnread);
				}

				//marked (starred)
				if (dbHdr.isFlagged)
				{
					if (!this.settings.bArchiveMarked)
					{
						return;
					}

					other = false;
					ageInDays = Math.max(ageInDays, this.settings.daysMarked);
				}

				//tagged
				if (Helper.messageHasTags(dbHdr))
				{
					if (!this.settings.bArchiveTagged)
					{
						return;
					}

					other = false;
					ageInDays = Math.max(ageInDays, this.settings.daysTagged);
				}

				if (other)
				{
					if (!this.settings.bArchiveOther)
					{
						return;
					}
					ageInDays = Math.max(ageInDays, this.settings.daysOther);
				}

				if (Helper.messageGetAgeInDays(dbHdr) <= ageInDays)
				{
					return;
				}

				//check if archive is possible for this message/in this account
				//TODO: actual it is not clear how to get the archiveEnabled for the identity in the beginning and not for every message
				const mail3PaneWindow: Mail3Pane = Helper.getMail3Pane();
				if (mail3PaneWindow.getIdentityForHeader(dbHdr).archiveEnabled)
				{
					this.messages.push(dbHdr);
				}
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		//after the search was done, archive all messages
		public onSearchDone(status: number): void
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("message search done for '" + this.folder.name + "' in account '" + this.folder.server.prettyName + "' -> " + this.messages.length + " messages found to archive");
			let result = 0;
			if (this.messages.length > 0)
			{
				result = this.archiveMessages();
			}
			this.activity.stopAndSetFinal(result);
			this.onFolderArchivedEvent();
		}

		public onNewSearch(): void
		{
			//nothing to do, but we have to fulfil the interface
		}
	}

	//-------------------------------------------------------------------------------------
	//main class
	class Autoarchiver
	{
		//properties:
		private foldersArchived: number = 0;
		private onDoneEvent: () => void;

		constructor(onDoneEvent: () => void)
		{
			this.onDoneEvent = onDoneEvent;
		}

		//archive messages for all accounts
		//(depending on the autoarchive options of the account)
		public archiveAccounts(): void
		{
			try
			{
				this.foldersArchived = 0;

				let foldersToArchive = 0;

				AutoarchiveReloadedBootstrap.AccountIterator.forEachAccount((account: MailAccount, isAccountArchivable: boolean) =>
				{
					AutoarchiveReloadedWebextension.loggerWebExtension.info("check account '" + account.name + "'");
					if (isAccountArchivable)
					{
						const accountSettings = AutoarchiveReloadedBootstrap.settings.accountSettings[account.id];
						SettingsHelper.log(account.name, accountSettings);
						if (SettingsHelper.isArchivingSomething(accountSettings))
						{
							const inboxFolders: Ci.nsIMsgFolder[] = [];
							AutoarchiveReloadedWebextension.loggerWebExtension.info("getting folders to archive in account '" + account.name + "'");

							//TODO: does account.folders contain all folders recursively?
							//TODO: cast is a hack to force compile
							this.getFolders(account.folders as unknown as Ci.nsIMsgFolder, inboxFolders);

							foldersToArchive += inboxFolders.length;
							for (const folder of inboxFolders)
							{
								this.archiveFolder(folder, accountSettings);
							}
						}
						else
						{
							AutoarchiveReloadedWebextension.loggerWebExtension.info("autoarchive disabled, ignore account '" + account.name + "'");
						}
					}
					else
					{
						AutoarchiveReloadedWebextension.loggerWebExtension.info("ignore account '" + account.name + "'");
					}
				});

				this.checkForArchiveDone(foldersToArchive);
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		//determine all folders (recursive, starting with param folder), which we want to archive
		//write output to inboxFolders array
		private getFolders(folder: Ci.nsIMsgFolder, outInboxFolders: Ci.nsIMsgFolder[]): void
		{
			try
			{
				//attention do not try to get the folderURL for IMAP account (it crashes or may crash)

				//Do not archive some special folders (and also no subfolders in there)
				//Inbox - yes
				//SentMail - yes, sure
				//Drafts - no, because you want to send them?
				//Trash - no, trash is trash
				//Templates - no, because you want to use it
				//Junk - no junk is junk
				//Archive - no, we do archive
				//Queue - no, must be sent?
				//Virtual - no, it is virtual :)
				if (folder.getFlag(Ci.nsMsgFolderFlags.Trash) || folder.getFlag(Ci.nsMsgFolderFlags.Junk) || folder.getFlag(Ci.nsMsgFolderFlags.Queue) || folder.getFlag(Ci.nsMsgFolderFlags.Drafts) || folder.getFlag(Ci.nsMsgFolderFlags.Templates) || folder.getFlag(Ci.nsMsgFolderFlags.Archive) || folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
				{
					AutoarchiveReloadedWebextension.loggerWebExtension.info("ignore folder '" + folder.name + "'");
					return;
				}

				//a Feed account (RSS Feeds) will be listed here, but it is kicked out later because it does not have archive options...

				outInboxFolders.push(folder);

				if (folder.hasSubFolders)
				{
					for (const subFolder of fixIterator(folder.subFolders, Ci.nsIMsgFolder))
					{
						this.getFolders(subFolder, outInboxFolders);
					}
				}
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		private archiveFolder(folder: Ci.nsIMsgFolder, settings: IAccountSettings): void
		{
			try
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("start searching messages to archive in folder '" + folder.name + "' in account '" + folder.server.prettyName + "'");
				//build a search for the messages to archive
				const searchSession: Ci.nsIMsgSearchSession = Cc["@mozilla.org/messenger/searchSession;1"].createInstance(Ci.nsIMsgSearchSession);
				searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, folder);

				//attention: the strange value copy syntax is needed!

				//find only messages with interesting age
				//AgeInDays > age
				const searchByAge = searchSession.createTerm();
				searchByAge.attrib = Ci.nsMsgSearchAttrib.AgeInDays;
				let value = searchByAge.value;
				value.attrib = Ci.nsMsgSearchAttrib.AgeInDays;
				value.age = SettingsHelper.getMinAge(settings);
				searchByAge.value = value;
				searchByAge.op = Ci.nsMsgSearchOp.IsGreaterThan;
				searchByAge.booleanAnd = true;
				searchSession.appendTerm(searchByAge);

				//do not search for (marked as) deleted messages
				const termNoDeleted = searchSession.createTerm();
				value = termNoDeleted.value;
				value.status = Ci.nsMsgMessageFlags.IMAPDeleted;
				value.attrib = Ci.nsMsgSearchAttrib.MsgStatus;
				termNoDeleted.value = value;
				termNoDeleted.attrib = Ci.nsMsgSearchAttrib.MsgStatus;
				termNoDeleted.op = Ci.nsMsgSearchOp.Isnt;
				termNoDeleted.booleanAnd = true;
				searchSession.appendTerm(termNoDeleted);

				//the other search parameters will be done in the listener itself, we can not create such a search
				//also the real archiving is done on the SearchListener...
				const activity = new ActivityManager(folder);

				searchSession.registerListener(new SearchListener(folder, activity, settings, () =>
				{
					this.foldersArchived++;
				}));
				searchSession.search(null);
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				throw e;
			}
		}

		private checkForArchiveDone(foldersToArchive: number): void
		{
			//wait until all accounts are ready
			if (this.foldersArchived === foldersToArchive)
			{
				//fire event
				this.onDoneEvent();
			}
			else
			{
				setTimeout(this.checkForArchiveDone.bind(this, foldersToArchive), 500);
			}
		}
	}

	//-------------------------------------------------------------------------------------

	enum States
	{
		UNINITIALZED, //also if you use the old autoarchive plugin
		READY_FOR_WORK,
		IN_PROGRESS,
	}

	//singleton with global /startup/ui functions
	export class Global
	{
		private static status: States = States.UNINITIALZED;

		public static async startup(): Promise<void>
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("start...");

			const appInfoLogger = new AppInfoLogger();
			await appInfoLogger.log();

			this.status = States.READY_FOR_WORK;
			AutoarchiveReloadedWebextension.loggerWebExtension.info("ready for work");

			if (AutoarchiveReloadedBootstrap.settings.globalSettings.archiveType === "startup")
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("archive type at startup");

				//wait some time to give TB time to connect and everything
				setTimeout(this.onDoArchiveAutomatic.bind(this), 9000);

				//repeat after one day (if someone has open Thunderbird all the time)
				setInterval(this.onDoArchiveAutomatic.bind(this), 86400000);
			}
			else
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("archive type manually");
			}
		}

		public static onDoArchiveAutomatic(): void
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("try automatic archive");
			if (this.status !== States.READY_FOR_WORK)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("automatic archive busy, wait");
				//busy: wait 5 seconds
				setTimeout(this.onDoArchiveAutomatic.bind(this), 5000);
			}
			else
			{
				this.onDoArchive();
			}
		}

		public static onDoArchive(): void
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("start archiving");
			this.status = States.IN_PROGRESS;
			const autoarchiveReloaded = new Autoarchiver(this.onArchiveDone.bind(this));
			autoarchiveReloaded.archiveAccounts();
		}

		public static onArchiveManually(): void
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("try manual archive");
			if (this.status === States.UNINITIALZED)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("not initialized, cancel");

				Helper.alert(browser.i18n.getMessage("waitForInit")); //TODO: browser.i18n.getMessage("dialogTitle")
				return;
			}

			if (Helper.confirm(browser.i18n.getMessage("dialogStartManualText")))//TODO: browser.i18n.getMessage("dialogTitle")
			{
				if (this.status === States.IN_PROGRESS)
				{
					AutoarchiveReloadedWebextension.loggerWebExtension.info("busy with other archive..., cancel");
					Helper.alert(browser.i18n.getMessage("waitForArchive")); //TODO: browser.i18n.getMessage("dialogTitle")
					return;
				}
				this.onDoArchive();
			}
			else
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.info("manual archive canceled by user");
			}
		}

		private static onArchiveDone(): void
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("archive (searching messages to archive) done");
			this.status = States.READY_FOR_WORK;
		}
	}

	//-----------------------------------------------------------------------------------------------------
	export class SettingsHelper
	{
		public static isArchivingSomething(accountSettings: IAccountSettings): boolean
		{
			return (accountSettings.bArchiveOther || accountSettings.bArchiveMarked || accountSettings.bArchiveTagged || accountSettings.bArchiveUnread);
		}

		public static getMinAge(accountSettings: IAccountSettings): number
		{
			let minAge = Number.MAX_VALUE;
			if (accountSettings.bArchiveOther)
			{
				minAge = Math.min(accountSettings.daysOther, minAge);
			}
			if (accountSettings.bArchiveMarked)
			{
				minAge = Math.min(accountSettings.daysMarked, minAge);
			}
			if (accountSettings.bArchiveTagged)
			{
				minAge = Math.min(accountSettings.daysTagged, minAge);
			}
			if (accountSettings.bArchiveUnread)
			{
				minAge = Math.min(accountSettings.daysUnread, minAge);
			}

			return minAge;
		}

		public static log(accountName: string, accountSettings: IAccountSettings)
		{
			AutoarchiveReloadedWebextension.loggerWebExtension.info("Settings for '" + accountName + "':");
			AutoarchiveReloadedWebextension.loggerWebExtension.info(JSON.stringify(accountSettings));
		}
	}

	//-----------------------------------------------------------------------------------------------------
	//-----------------------------------------------------------------------------------------------------
	class AppInfoLogger
	{
		public async log(): Promise<void>
		{
			//TODO: reactivate
			if (1 === 1)
			{
				return;
			}
			this.logAppInfo();
			this.logAddonInfo();
			await this.logAccountInfo();
		}

		private logAppInfo(): void
		{
			try
			{
				const appInfo: Ci.nsIXULAppInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);

				//the new extension system does not provide a window > use mail3pane instead
				const window = Helper.getMail3Pane();
				AutoarchiveReloadedWebextension.loggerWebExtension.info("ApplicationInfo ID:" + appInfo.ID + "; Version:" + appInfo.version + "; BuildID:" + appInfo.appBuildID + "; PlatformVersion:" + appInfo.platformVersion + "; PlatformBuildID:" + appInfo.platformBuildID + "; language: " + window.navigator.language);

				AutoarchiveReloadedWebextension.loggerWebExtension.info("SystemInfo " + window.navigator.oscpu + "| " + window.navigator.platform + "| " + window.navigator.userAgent);
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				//don't throw... this method is only info logging...
			}
		}

		private logAddonInfo(): void
		{
			try
			{
				AddonManager.getAllAddons((addons: Addon[]) =>
				{
					for (const addon of addons)
					{
						AutoarchiveReloadedWebextension.loggerWebExtension.info("Installed Addon-Info: " + addon.name + " (" + addon.id + ") version " + addon.version + "; active: " + addon.isActive);
					}
				});
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				//don't throw... this method is only info logging...
			}
		}

		private async logAccountInfo(): Promise<void>
		{
			try
			{
				await AutoarchiveReloadedBootstrap.AccountIterator.forEachAccount((account: MailAccount, isAccountArchivable: boolean) =>
				{
					AutoarchiveReloadedWebextension.loggerWebExtension.info("Account Info: '" + account.name + "'; type: " +
						account.type + "; id: " + account.id);
				});
			}
			catch (e)
			{
				AutoarchiveReloadedWebextension.loggerWebExtension.errorException(e);
				//don't throw... this method is only info logging...
			}
		}
	}

}