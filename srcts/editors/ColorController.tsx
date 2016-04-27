import * as React from "react";
import {HBox, VBox} from "../react-ui/FlexBox";
import Tabs from "../react-ui/Tabs";
import Checkbox from "../semantic-ui/Checkbox";
import SelectableAttributeComponent from "../ui/SelectableAttributeComponent";
import BinningDefinitionEditor from "./BinningDefinitionEditor";
import ColorRampEditor from "./ColorRampEditor";
import {linkReactStateRef} from "../utils/WeaveReactUtils";
import PopupWindow from "../react-ui/PopupWindow";
import IColumnWrapper = weavejs.api.data.IColumnWrapper;
import ColorColumn = weavejs.data.column.ColorColumn;
import BinnedColumn = weavejs.data.column.BinnedColumn;
import FilteredColumn = weavejs.data.column.FilteredColumn;

export interface ColorControllerProps extends React.Props<ColorController>
{
	colorColumn:ColorColumn;
}

export interface ColorControllerState
{
	
}

export default class ColorController extends React.Component<ColorControllerProps, ColorControllerState>
{
	
	tabLabels = ["Color Scale", "Binning"]; // , "Color Specific Records"]
	attributes = new Map<string, IColumnWrapper>();
	static window:PopupWindow;
	static activeTabIndex:number = 0;

	constructor(props:ColorControllerProps)
	{
		super(props);
		this.attributes.set("Color Data", this.props.colorColumn);
	}
	
	static close(window:PopupWindow)
	{
		ColorController.window = null;
	}

	static open(colorColumn:ColorColumn)
	{
		if (!colorColumn)
			return;
		
		if (ColorController.window)
			PopupWindow.close(ColorController.window);
		
		ColorController.window = PopupWindow.open({
			title: Weave.lang("Color Controller"),
			content: <ColorController colorColumn={colorColumn}/>,
			resizable: true,
			width: 920,
			height: 675,
			onClose: ColorController.close
		});
		
		Weave.getCallbacks(colorColumn).addDisposeCallback(ColorController.window, () => PopupWindow.close(ColorController.window));
	}
	
	get binnedColumn():BinnedColumn { return this.props.colorColumn && this.props.colorColumn.getInternalColumn() as BinnedColumn };
	get dataColumn():FilteredColumn { return this.binnedColumn && this.binnedColumn.internalDynamicColumn.target as FilteredColumn };

	handleFilterCheck = (value:boolean) =>
	{
		if (value)
			this.dataColumn.filter.targetPath = ["defaultSubsetKeyFilter"];
		else
			this.dataColumn.filter.targetPath = null;
	}
	
	render():JSX.Element
	{
		return (
			<VBox style={{flex: 1}}>
				<Tabs
					activeTabIndex={ColorController.activeTabIndex}
					onViewChange={(index) => ColorController.activeTabIndex = index}
					labels={this.tabLabels}
					tabs={[
						<VBox key={this.tabLabels[1]} style={ {flex: 1} } className="weave-padded-vbox">
							<Checkbox ref={linkReactStateRef(this, {value: this.props.colorColumn.rampCenterAtZero})} label={Weave.lang("Center color ramp at zero (when binning is disabled)")}/>
							<ColorRampEditor colorRamp={this.props.colorColumn.ramp}/>
						</VBox>,
						<VBox className="weave-padded-vbox" key={this.tabLabels[0]} style={{flex: 1}}>
							<HBox className="weave-padded-hbox" style={ {alignItems: "center"} }>
								{Weave.lang("Color data")}
								<SelectableAttributeComponent attributes={this.attributes} attributeName="Color Data"/>
							</HBox>
							<BinningDefinitionEditor binnedColumn={this.binnedColumn}/>
							<Checkbox onChange={this.handleFilterCheck} label={Weave.lang("Filter records prior to binning")}/>
						</VBox>
					]}
				/>
			</VBox>
		);
	}
}
