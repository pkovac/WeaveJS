/*
    Weave (Web-based Analysis and Visualization Environment)
    Copyright (C) 2008-2011 University of Massachusetts Lowell

    This file is a part of Weave.

    Weave is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License, Version 3,
    as published by the Free Software Foundation.

    Weave is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Weave.  If not, see <http://www.gnu.org/licenses/>.
*/

package weave.core
{
	import flash.utils.getTimer;
	
	import mx.utils.ObjectUtil;
	
	import weave.api.WeaveAPI;
	import weave.api.core.ICallbackCollection;
	import weave.api.core.IDisposableObject;
	import weave.api.core.ILinkableObject;
	import weave.api.core.ILinkableVariable;
	import weave.api.getCallbackCollection;
	import weave.api.registerDisposableChild;
	import weave.api.registerLinkableChild;

	/**
	 * This class saves the session history of an ILinkableObject.
	 * 
	 * @author adufilie
	 */
	public class SessionStateLog implements ILinkableVariable, IDisposableObject
	{
		public static var debug:Boolean = false;
		
		public function SessionStateLog(subject:ILinkableObject, syncDelay:uint = 0)
		{
			_subject = subject;
			_syncDelay = syncDelay;
			_prevState = WeaveAPI.SessionManager.getSessionState(_subject); // remember the initial state
			registerDisposableChild(_subject, this); // make sure this is disposed when _subject is disposed
			
			var cc:ICallbackCollection = getCallbackCollection(_subject);
			cc.addImmediateCallback(this, immediateCallback);
			cc.addGroupedCallback(this, groupedCallback);
		}
		
		/**
		 * @inheritDoc
		 */		
		public function dispose():void
		{
			if (_undoHistory == null)
				throw new Error("SessionStateLog.dispose() called more than once");
			
			_subject = null;
			_undoHistory = null;
			_redoHistory = null;
		}
		
		private var _subject:ILinkableObject; // the object we are monitoring
		private var _syncDelay:uint; // the number of milliseconds to wait before automatically synchronizing
		private var _prevState:Object = null; // the previously seen session state of the subject
		private var _undoHistory:Array = []; // diffs that can be undone
		private var _redoHistory:Array = []; // diffs that can be redone
		private var _nextId:int = 0; // gets incremented each time a new diff is created
		private var _undoActive:Boolean = false; // true while an undo operation is active
		private var _redoActive:Boolean = false; // true while a redo operation is active
		
		private var _syncTime:int = getTimer(); // this is set to getTimer() when synchronization occurs
		private var _triggerDelay:int = -1; // this is set to (getTimer() - _syncTime) when immediate callbacks are triggered for the first time since the last synchronization occurred
		private var _saveTime:uint = 0; // this is set to getTimer() + _syncDelay to determine when the next diff should be computed and logged
		private var _savePending:Boolean = false; // true when a diff should be computed
		
		/**
		 * When this is set to true, changes in the session state of the subject will be automatically logged.
		 */
		public const enableLogging:LinkableBoolean = registerLinkableChild(this, new LinkableBoolean(true), synchronizeNow);
		
		/**
		 * This will clear all undo and redo history.
		 * @param directional Zero will clear everything. Set this to -1 to clear all undos or 1 to clear all redos.
		 */
		public function clearHistory(directional:int = 0):void
		{
			var cc:ICallbackCollection = getCallbackCollection(this);
			cc.delayCallbacks();
			
			synchronizeNow();
			
			if (directional <= 0)
			{
				if (_undoHistory.length > 0)
					cc.triggerCallbacks();
				_undoHistory.length = 0;
			}
			if (directional >= 0)
			{
				if (_redoHistory.length > 0)
					cc.triggerCallbacks();
				_redoHistory.length = 0;
			}
			
			cc.resumeCallbacks();
		}
		
		/**
		 * This gets called as an immediate callback of the subject.
		 */		
		private function immediateCallback():void
		{
			if (!enableLogging.value)
				return;
			
			// we have to wait until grouped callbacks are called before we save the diff
			_saveTime = uint.MAX_VALUE;
			
			// make sure only one call to saveDiff() is pending
			if (!_savePending)
			{
				_savePending = true;
				saveDiff();
			}
			
			if (debug && (_undoActive || _redoActive))
			{
				var state:Object = WeaveAPI.SessionManager.getSessionState(_subject);
				var forwardDiff:* = WeaveAPI.SessionManager.computeDiff(_prevState, state);
				trace('immediate diff:', ObjectUtil.toString(forwardDiff));
			}
		}
		
		/**
		 * This gets called as a grouped callback of the subject.
		 */
		private function groupedCallback():void
		{
			if (!enableLogging.value)
				return;
			
			// Since grouped callbacks are currently running, it means something changed, so make sure the diff is saved.
			immediateCallback();
			// It is ok to save a diff some time after the last time grouped callbacks are called.
			// If callbacks are triggered again before the next frame, the immediateCallback will reset this value.
			_saveTime = getTimer() + _syncDelay;
			
			if (debug && (_undoActive || _redoActive))
			{
				var state:Object = WeaveAPI.SessionManager.getSessionState(_subject);
				var forwardDiff:* = WeaveAPI.SessionManager.computeDiff(_prevState, state);
				trace('grouped diff:', ObjectUtil.toString(forwardDiff));
			}
		}
		
		/**
		 * This will save a diff in the history, if there is any.
		 * @param immediately Set to true if it should be saved immediately, or false if it can wait.
		 */
		private function saveDiff(immediately:Boolean = false):void
		{
			// remember how long it's been since the last synchronization
			if (_triggerDelay < 0)
				_triggerDelay = getTimer() - _syncTime;
			
			if (!immediately && getTimer() < _saveTime)
			{
				// we have to wait until the next frame to save the diff because grouped callbacks haven't finished.
				WeaveAPI.StageUtils.callLater(this, saveDiff, null, false);
				return;
			}
			
			var cc:ICallbackCollection = getCallbackCollection(this);
			cc.delayCallbacks();
			
			var state:Object = WeaveAPI.SessionManager.getSessionState(_subject);
			var forwardDiff:* = WeaveAPI.SessionManager.computeDiff(_prevState, state);
			if (forwardDiff !== undefined)
			{
				var backwardDiff:* = WeaveAPI.SessionManager.computeDiff(state, _prevState);
				var item:LogEntry;
				if (_undoActive)
				{
					item = new LogEntry(_nextId++, backwardDiff, forwardDiff, _triggerDelay);
					// overwrite first redo entry because grouped callbacks may have behaved differently
					_redoHistory[0] = item;
				}
				else
				{
					item = new LogEntry(_nextId++, forwardDiff, backwardDiff, _triggerDelay);
					if (_redoActive)
					{
						// overwrite last undo entry because grouped callbacks may have behaved differently
						_undoHistory[_undoHistory.length - 1] = item;
					}
					else
					{
						// save new undo entry
						_undoHistory.push(item);
					}
				}
				
				if (debug)
					debugHistory(item);
				
				cc.triggerCallbacks();
			}
			
			_prevState = state;
			_undoActive = false;
			_redoActive = false;
			_savePending = false;
			_triggerDelay = -1;
			_syncTime = getTimer();
			
			cc.resumeCallbacks();
		}

		/**
		 * This function will save any pending diff in session state.
		 * Use this function only when necessary (for example, when writing a collaboration service that must synchronize).
		 */
		public function synchronizeNow():void
		{
			saveDiff(true);
		}
		
		/**
		 * This will undo a number of steps from the saved history.
		 * @param numberOfSteps The number of steps to undo.
		 */
		public function undo(numberOfSteps:int = 1):void
		{
			applyDiffs(-numberOfSteps);
		}
		
		/**
		 * This will redo a number of steps that have been previously undone.
		 * @param numberOfSteps The number of steps to redo.
		 */
		public function redo(numberOfSteps:int = 1):void
		{
			applyDiffs(numberOfSteps);
		}
		
		/**
		 * This will apply a number of undo or redo steps.
		 * @param delta The number of steps to undo (negative) or redo (positive).
		 */
		private function applyDiffs(delta:int):void
		{
			var stepsRemaining:int = Math.min(Math.abs(delta), delta < 0 ? _undoHistory.length : _redoHistory.length);
			if (stepsRemaining > 0)
			{
				var logEntry:LogEntry;
				var diff:Object;
				var debug:Boolean = debug && stepsRemaining == 1;
				
				// if something changed and we're not currently undoing/redoing, save the diff now
				if (_savePending && !_undoActive && !_redoActive)
					synchronizeNow();
				
				getCallbackCollection(_subject).delayCallbacks();
				while (stepsRemaining-- > 0)
				{
					if (delta < 0)
					{
						logEntry = _undoHistory.pop();
						_redoHistory.unshift(logEntry);
						diff = logEntry.backward;
					}
					else
					{
						logEntry = _redoHistory.shift();
						_undoHistory.push(logEntry);
						diff = logEntry.forward;
					}
					if (debug)
						trace('apply ' + (delta < 0 ? 'undo' : 'redo'), logEntry.id + ':', ObjectUtil.toString(diff));
					
					// remember the session state right before applying the last step
					if (stepsRemaining == 0)
						_prevState = WeaveAPI.SessionManager.getSessionState(_subject);
					WeaveAPI.SessionManager.setSessionState(_subject, diff, false);
					
					if (debug)
					{
						var newState:Object = WeaveAPI.SessionManager.getSessionState(_subject);
						var resultDiff:Object = WeaveAPI.SessionManager.computeDiff(_prevState, newState);
						trace('resulting diff:', ObjectUtil.toString(resultDiff));
					}
				}
				getCallbackCollection(_subject).resumeCallbacks();
				
				_undoActive = delta < 0 && _savePending;
				_redoActive = delta > 0 && _savePending;
				getCallbackCollection(this).triggerCallbacks();
			}
		}
		
		/**
		 * @TODO create an interface for the objects in this Array
		 */
		public function get undoHistory():Array
		{
			return _undoHistory;
		}
		
		/**
		 * @TODO create an interface for the objects in this Array
		 */
		public function get redoHistory():Array
		{
			return _redoHistory;
		}

		private function debugHistory(logEntry:LogEntry):void
		{
			var h:Array = _undoHistory.concat();
			for (var i:int = 0; i < h.length; i++)
				h[i] = h[i].id;
			var f:Array = _redoHistory.concat();
			for (i = 0; i < f.length; i++)
				f[i] = f[i].id;
			if (logEntry)
			{
				trace("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
				trace('NEW HISTORY (backward) ' + logEntry.id + ':', ObjectUtil.toString(logEntry.backward));
				trace("===============================================================");
				trace('NEW HISTORY (forward) ' + logEntry.id + ':', ObjectUtil.toString(logEntry.forward));
				trace(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
			}
			trace('undo ['+h+']','redo ['+f+']');
		}
		
		/**
		 * This will generate an untyped session state object that contains the session history log.
		 * @return An object containing the session history log.
		 */		
		public function getSessionState():Object
		{
			var cc:ICallbackCollection = getCallbackCollection(this);
			cc.delayCallbacks();
			synchronizeNow();
			
			// The "version" property can be used to detect old session state formats and should be incremented whenever the format is changed.
			var state:Object = {
				"version": 0,
				"currentState": _prevState,
				"undoHistory": _undoHistory.concat(),
				"redoHistory": _redoHistory.concat(),
				"nextId": _nextId,
				"enableLogging": enableLogging.value
			};
			
			cc.resumeCallbacks();
			return state;
		}
		
		/**
		 * This will load a session state log from an untyped session state object.
		 * @param input The ByteArray containing the output from seralize().
		 */
		public function setSessionState(state:Object):void
		{
			// make sure callbacks only run once while we set the session state
			var cc:ICallbackCollection = getCallbackCollection(this);
			cc.delayCallbacks();
			enableLogging.delayCallbacks();
			try
			{
				var version:Number = state.version;
				switch (version)
				{
					case 0:
					{
						_prevState = state.currentState;
						_undoHistory = LogEntry.convertGenericObjectsToLogEntries(state.undoHistory, _syncDelay);
						_redoHistory = LogEntry.convertGenericObjectsToLogEntries(state.redoHistory, _syncDelay);
						_nextId = state.nextId;
						enableLogging.value = state.enableLogging;
						
						break;
					}
					default:
						throw new Error("Weave history format version " + version + " is unsupported.");
				}
				
				// reset these flags so nothing unexpected happens in later frames
				_undoActive = false;
				_redoActive = false;
				_savePending = false;
				_saveTime = 0;
				_triggerDelay = -1;
				_syncTime = getTimer();
			
				WeaveAPI.SessionManager.setSessionState(_subject, _prevState);
			}
			finally
			{
				enableLogging.resumeCallbacks();
				cc.triggerCallbacks();
				cc.resumeCallbacks();
			}
		}
	}
}
import flash.utils.getTimer;

internal class LogEntry
{
	public function LogEntry(id:int, forward:Object, backward:Object, triggerDelay:int)
	{
		this.id = id;
		this.forward = forward;
		this.backward = backward;
		this.triggerDelay = triggerDelay;
	}
	
	public var id:int;
	public var forward:Object; // the diff for applying redo
	public var backward:Object; // the diff for applying undo
	public var triggerDelay:int; // the length of time between the last synchronization and the diff
	
	/**
	 * This will convert an Array of generic objects to an Array of LogEntry objects.
	 * Generic objects are easier to create backwards compatibility for.
	 */
	public static function convertGenericObjectsToLogEntries(array:Array, defaultTriggerDelay:int):Array
	{
		for (var i:int = 0; i < array.length; i++)
		{
			var o:Object = array[i];
			if (!(o is LogEntry))
				array[i] = new LogEntry(o.id, o.forward, o.backward, o.triggerDelay || defaultTriggerDelay);
		}
		return array;
	}
}
