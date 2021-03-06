namespace weavejs.ui
{
	import ObjectDataTable = weavejs.ui.DataTable.ObjectDataTable;
	import AbstractBinningDefinition = weavejs.data.bin.AbstractBinningDefinition;
	import IRow = weavejs.ui.DataTable.IRow;

	export interface BinNamesListProps {
		binningDefinition:AbstractBinningDefinition;
		showHeaderRow?:boolean;
	}
	export class BinNamesList extends React.Component<BinNamesListProps, {}>
	{
		constructor(props:BinNamesListProps)
		{
			super(props);
			if (this.props.binningDefinition){
				Weave.getCallbacks(this.props.binningDefinition).addGroupedCallback(this,this.forceUpdate);
			}
		}

		componentWillReceiveProps(nextProps:BinNamesListProps) {
			if (this.props.binningDefinition !== nextProps.binningDefinition){
				// null is possible when user selects option "none"
				if (this.props.binningDefinition)Weave.getCallbacks(this.props.binningDefinition).removeCallback(this,this.forceUpdate);
				if (nextProps.binningDefinition)Weave.getCallbacks(nextProps.binningDefinition).addGroupedCallback(this,this.forceUpdate);
			}
		}

		componentWillUnmount(){
			if (this.props.binningDefinition)Weave.getCallbacks(this.props.binningDefinition).removeCallback(this,this.forceUpdate);
		}
		
		static defaultProps:BinNamesListProps = {
			showHeaderRow: true,
			binningDefinition: null
		};
		
		render()
		{
			var binDef:AbstractBinningDefinition = this.props.binningDefinition;
			var rows:IRow[] = [];
			if (binDef)
			{
				rows = binDef.getBinNames().map((binName, index) => {
					return {
						id: index,
						value: binName
					} as IRow;
				});
			}
			
			var columnTitles:{[columnId:string]: string|JSX.Element} = {
				id: "Key",
				value: "Bin names"
			};

			return (
				<ObjectDataTable columnIds={["value"]}
								 idProperty="id"
								 rows={rows}
								 columnTitles={columnTitles}
								 headerHeight={this.props.showHeaderRow ? undefined : 0}
								 allowResizing={false}
								 evenlyExpandRows={true}
								 enableHover={false}
								 enableSelection={false}
				/>
			);
		}
	}
}
