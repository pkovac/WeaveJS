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
	import flash.utils.Dictionary;
	import flash.utils.getQualifiedClassName;
	
	import weave.api.core.ILinkableObject;
	import weave.api.newDisposableChild;
	import weave.api.ui.IEditorManager;
	import weave.api.ui.ILinkableObjectEditor;

	/**
	 * Manages implementations of ILinkableObjectEditor.
	 */
	public class EditorManager implements IEditorManager
	{
		private const _editorLookup:Dictionary = new Dictionary();
		
		/**
		 * @inheritDoc
		 */
		public function registerEditor(objType:Class, editorType:Class):void
		{
			var editorQName:String = getQualifiedClassName(editorType);
			var interfaceQName:String = getQualifiedClassName(ILinkableObjectEditor);
			if (!ClassUtils.classImplements(editorQName, interfaceQName))
				throw new Error(editorQName + " does not implement " + interfaceQName);
			
			_editorLookup[objType] = editorType;
		}
		
		/**
		 * @inheritDoc
		 */
		public function getEditorClass(linkableObjectOrClass:Object):Class
		{
			var classQName:String = linkableObjectOrClass as String || getQualifiedClassName(linkableObjectOrClass);
			var superClasses:Array = ClassUtils.getClassExtendsList(classQName);
			superClasses.unshift(classQName);
			for (var i:int = 0; i < superClasses.length; i++)
			{
				classQName = superClasses[i];
				var classDef:Class = ClassUtils.getClassDefinition(classQName);
				var editorClass:Class = _editorLookup[classDef] as Class
				if (editorClass)
					return editorClass;
			}
			return null;
		}
		
		/**
		 * @inheritDoc
		 */
		public function getNewEditor(obj:ILinkableObject):ILinkableObjectEditor
		{
			var Editor:Class = getEditorClass(obj);
			if (Editor)
			{
				var editor:ILinkableObjectEditor = newDisposableChild(obj, Editor); // when the object goes away, make the editor go away
				editor.setTarget(obj);
				return editor;
			}
			return null;
		}
	}
}
