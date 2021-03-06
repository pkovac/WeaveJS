namespace weavejs.tool
{
	import IPlotter = weavejs.api.ui.IPlotter;
	import ScatterPlotPlotter = weavejs.plot.ScatterPlotPlotter;
	import Bounds2D = weavejs.geom.Bounds2D;
	import DynamicComponent = weavejs.ui.DynamicComponent;
	import IPlotTask = weavejs.api.ui.IPlotTask;
	import DOMUtils = weavejs.util.DOMUtils;
	import IVisToolProps = weavejs.api.ui.IVisToolProps;
	import IVisToolState = weavejs.api.ui.IVisToolState;
	import ILinkableObjectWithNewProperties = weavejs.api.core.ILinkableObjectWithNewProperties;
	import ISelectableAttributes = weavejs.api.data.ISelectableAttributes;
	import IVisTool = weavejs.api.ui.IVisTool;

	export interface PIXIScatterPlotProps extends IVisToolProps
	{

	}

	export interface PIXIScatterPlotState extends IVisToolState
	{

	}

	export class PIXIScatterPlot extends AbstractVisTool<PIXIScatterPlotProps, PIXIScatterPlotState>
	{
		element:HTMLDivElement;
		renderer:PIXI.WebGLRenderer | PIXI.CanvasRenderer;
		graphics:PIXI.Graphics = new PIXI.Graphics();
		stage:PIXI.Container = new PIXI.Container();
		plotter:ScatterPlotPlotter = Weave.linkableChild(this, ScatterPlotPlotter, this.forceUpdate, true);

		constructor(props:PIXIScatterPlotProps)
		{
			super(props);
			this.plotter.spatialCallbacks.addGroupedCallback(this, this.forceUpdate);
			this.plotter.filteredKeySet.keyFilter.targetPath = ['defaultSubsetKeyFilter'];
		}

		componentDidMount()
		{
			var canvas = ReactDOM.findDOMNode(this) as HTMLCanvasElement;
			this.renderer = PIXI.autoDetectRenderer(800, 600, {
				view: canvas,
				transparent: true,
				resolution: DOMUtils.getWindow(canvas).devicePixelRatio
			});
			this.renderer.autoResize = true;
			this.renderer.clearBeforeRender = true;
			this.stage.addChild(this.graphics);
		}

		componentDidUpdate()
		{
			var db = new Bounds2D();
			this.plotter.getBackgroundDataBounds(db);
			var task = {
				buffer: this.graphics,
				dataBounds: db,
				screenBounds: new Bounds2D(0, 600, 800, 0),
				recordKeys: this.plotter.filteredKeySet.keys,
				iteration: 0,
				iterationStopTime: Infinity,
				asyncState: {},
				progress: 0
			};
			while (task.progress < 1)
			{
				task.progress = this.plotter.drawPlotAsyncIteration(task);
				task.iteration++;
			}
			this.renderer.render(this.stage);
		}

		render()
		{
			return (
				<canvas style={{flex: 1}}/>
			);
		}
	}

	Weave.registerClass(
		PIXIScatterPlot,
		["weavejs.tool.PIXIScatterPlot"/*, "weave.visualization.tools::ScatterPlotTool"*/],
		[
			IVisTool,
			ILinkableObjectWithNewProperties,
			ISelectableAttributes,
		],
		"Scatter Plot"
	);
}
