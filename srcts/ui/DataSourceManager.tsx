import * as React from "react";
import {HBox, VBox} from "../react-ui/FlexBox";
import {ListOption} from "../react-ui/List";
import List from "../react-ui/List";
import PopupWindow from "../react-ui/PopupWindow";
import MenuButton from "../react-ui/MenuButton";
import {IDataSourceEditorProps} from "../editors/DataSourceEditor";
import {MenuItemProps} from "../react-ui/Menu";
import ControlPanel from "./ControlPanel";
import DataMenu from "../menus/DataMenu";
import CenteredIcon from "../react-ui/CenteredIcon";

import IDataSource = weavejs.api.data.IDataSource;

/* Import editors and their data sources */
import WeaveDataSource = weavejs.data.source.WeaveDataSource;
import WeaveDataSourceEditor from "../editors/WeaveDataSourceEditor";

import CSVDataSource = weavejs.data.source.CSVDataSource;
import CSVDataSourceEditor from "../editors/CSVDataSourceEditor";

import DBFDataSource = weavejs.data.source.DBFDataSource;
import DBFDataSourceEditor from "../editors/DBFDataSourceEditor";

import GeoJSONDataSource = weavejs.data.source.GeoJSONDataSource;
import GeoJSONDataSourceEditor from "../editors/GeoJSONDataSourceEditor";

import CensusDataSource = weavejs.data.source.CensusDataSource;
import CensusDataSourceEditor from "../editors/CensusDataSourceEditor";

import CKANDataSource = weavejs.data.source.CKANDataSource;
import CKANDataSourceEditor from "../editors/CKANDataSourceEditor";

// import CachedDataSource = weavejs.data.source.CachedDataSource;
// import CachedDataSourceEditor from "../editors/CachedDataSourceEditor";

import ForeignDataMappingTransform = weavejs.data.source.ForeignDataMappingTransform;
import ForeignDataMappingTransformEditor from "../editors/ForeignDataMappingTransformEditor";

import GroupedDataTransform = weavejs.data.source.GroupedDataTransform;
import GroupedDataTransformEditor from "../editors/GroupedDataTransformEditor";


export interface IDataSourceManagerProps
{
	dataMenu:DataMenu;
}

export interface IDataSourceManagerState
{
}

export default class DataSourceManager extends React.Component<IDataSourceManagerProps,IDataSourceManagerState>
{
	static editorRegistry = new Map<typeof IDataSource, React.ComponentClass<IDataSourceEditorProps>>()
		.set(CSVDataSource, CSVDataSourceEditor)
		.set(DBFDataSource, DBFDataSourceEditor)
		.set(GeoJSONDataSource, GeoJSONDataSourceEditor)
		.set(CensusDataSource, CensusDataSourceEditor)
		.set(CKANDataSource, CKANDataSourceEditor)
		.set(WeaveDataSource, WeaveDataSourceEditor)
//		.set(CachedDataSource, CachedDataSourceEditor) // should have a button to restore the original data source
		.set(ForeignDataMappingTransform, ForeignDataMappingTransformEditor)
		.set(GroupedDataTransform, GroupedDataTransformEditor)
//

	static selected:IDataSource;

	constructor(props:IDataSourceManagerProps)
	{
		super(props);
	}

	componentDidMount()
	{
		this.props.dataMenu.weave.root.childListCallbacks.addGroupedCallback(this, this.updateDataSources,true );
	}

	componentWillUnmount()
	{
		this.props.dataMenu.weave.root.childListCallbacks.removeCallback(this, this.updateDataSources);
	}

	updateDataSources()
	{
		let dataSources = this.props.dataMenu.weave.root.getObjects(IDataSource);

		dataSources.forEach((ds:IDataSource):void =>{
			Weave.getCallbacks(ds).addGroupedCallback(this, this.forceUpdate);//adding callbacks to every datasource
		});
		
		this.forceUpdate();
	}

	refreshDataSource(dataSource:IDataSource)
	{
		dataSource.hierarchyRefresh.triggerCallbacks();
		
		// TEMPORARY SOLUTION until all data sources behave correctly - force creating a new copy
		var root = this.props.dataMenu.weave.root;
		var name = root.getName(dataSource);
		if (name)
		{
			var names = root.getNames();
			root.requestObjectCopy(name, dataSource);
			root.setNameOrder(names);
		}
	}

	removeDataSource(dataSource:IDataSource)
	{
		let root = this.props.dataMenu.weave.root;
		root.removeObject(root.getName(dataSource));
	}

	render():JSX.Element
	{
		let root = this.props.dataMenu.weave.root;

		let listOptions:ListOption[] = root.getObjects(IDataSource).map(dataSource => {
			return {
				label: (
					<HBox style={{justifyContent: "space-between", alignItems:"center"}}>
						<span style={{overflow: "hidden"}}>{dataSource.getLabel()}</span>
						<HBox>
							<CenteredIcon onClick={()=>this.refreshDataSource(dataSource)}
							              iconProps={{ className: "fa fa-refresh", title: "Refresh this datasource" }}/>
							<CenteredIcon onClick={()=>this.removeDataSource(dataSource)}
							              iconProps={{ className: "fa fa-times", title: "Delete this datasource" }}/>
						</HBox>
					</HBox>
				),
				value: dataSource
			};
		});

		let editorJsx:JSX.Element;
		let dataSource = DataSourceManager.selected;

		if (dataSource && !Weave.wasDisposed(dataSource))
		{
			let EditorClass = DataSourceManager.editorRegistry.get(dataSource.constructor as typeof IDataSource);
			if (EditorClass)
				editorJsx = <EditorClass dataSource={dataSource} chartsMenu={ this.props.dataMenu.chartsMenu }/>;
			else
				editorJsx = <span>{Weave.lang("Editor not yet implemented for this data source type.")}</span>;
		}
		else {
			editorJsx = <span>{Weave.lang((listOptions.length ? "Select" : "Create") + " a data source on the left.")}</span>;
		}

		return (
			<HBox className="ui horizontal segments" style={ {flex:1, overflow:'auto'} }>
				<VBox style={{width: 250}}>
					<VBox className="ui attached segment" style={{flex:1}}>
						<VBox style={{flex: 1, overflow: "auto"}}>
							<div className="ui medium dividing header">{Weave.lang("Connected sources")}</div>
							<VBox>
								<List
									options={listOptions}
									multiple={false}
									selectedValues={ [dataSource] }
									onChange={ (selectedValues:IDataSource[]) => { DataSourceManager.selected = selectedValues[0]; this.forceUpdate(); }}
								/>
							</VBox>
						</VBox>
						<div style={{height: "1px", width: "100%"}}/>
						<div className="ui meadium dividing header">{Weave.lang("Add more...")}</div>
						<VBox style={{flex: 1, overflow: "auto"}}>
							{
								this.props.dataMenu.getDataSourceItems().map((dsItem, index) => {
									return dsItem.shown
										?   <HBox key={index} style={{justifyContent: "space-between"}}>
												{Weave.lang(dsItem.label as string)}
												<CenteredIcon onClick={() => dsItem.click()} className="" iconProps={{ className:"fa fa-plus" }}/>
											</HBox>
										:   null
								})
							}
						</VBox>
					</VBox>
				</VBox>
				<VBox className="ui segment" style={ { overflow:'auto'} }>
					{editorJsx}
				</VBox>
			</HBox>
		);
	}

	static openInstance(dataMenu:DataMenu, selected:IDataSource = null):ControlPanel
	{
		DataSourceManager.selected = selected;
		return ControlPanel.openInstance(dataMenu.weave, DataSourceManager, {title: Weave.lang("Data Sources")}, {dataMenu});
	}
}
