namespace weavejs.layout.flexiblelayout
{
	import prefixer = weavejs.css.prefixer;
	import MouseUtils = weavejs.util.MouseUtils;
	import ReactUtils = weavejs.util.ReactUtils;
	import Direction = weavejs.layout.flexiblelayout.DirectionTypes.Direction;
	import HORIZONTAL = weavejs.layout.flexiblelayout.DirectionTypes.HORIZONTAL;

	const mouseevents:string[] = ["mouseover", "mouseout", "mouseleave"];

	const STYLE_BASE = {
		background: "#000",
		opacity: .3,
		boxSizing: "border-box",
		backgroundClip: "padding",
		position: "absolute"
	};

	export interface IResizerOverlayProps extends React.Props<ResizerOverlay>
	{
		direction: Direction;
		thickness?: number;
	}

	export interface IResizerOverlayState
	{
		active?: boolean;
		range?: number[];
		x?: number;
		y?: number;
	};

	export class ResizerOverlay extends React.Component<IResizerOverlayProps, IResizerOverlayState>
	{
		constructor(props: IResizerOverlayProps)
		{
			super(props)
			this.state = {
			  active: false,
			  range: [],
			  x: 0,
			  y: 0
			};
		}

		componentDidMount():void
		{
			var document = ReactUtils.getDocument(this);
			document.addEventListener("mousemove", this.onMouseMove, true);
			mouseevents.forEach(mouseevent => document.addEventListener(mouseevent, this.stopEventPropagation, true));
		}

		componentWillUnmount():void
		{
			var document = ReactUtils.getDocument(this);
			document.removeEventListener("mousemove", this.onMouseMove)
			mouseevents.forEach(mouseevent => document.removeEventListener(mouseevent, this.stopEventPropagation));
		}

		stopEventPropagation=(event:Event):void=>
		{
			if (this.state.active)
			{
				event.stopImmediatePropagation();
			}
		}
		
		get thickness()
		{
			return this.props.thickness || 4;
		}

		onMouseMove=(event:MouseEvent):void=>
		{
			if (this.state.active)
			{
				event.stopImmediatePropagation();
				var container:HTMLElement = ReactDOM.findDOMNode(this).parentNode as HTMLElement;
				var offsetPoint = MouseUtils.getOffsetPoint(container, event);
				var mousePos: number = this.props.direction === HORIZONTAL ? offsetPoint.x : offsetPoint.y;

				mousePos = Math.max(this.state.range[0], Math.min(mousePos, this.state.range[1]));

				if (this.props.direction === HORIZONTAL)
				{
					this.setState({
						x: mousePos - this.thickness / 2,
						y: 0
					});
				}
				else
				{
					this.setState({
						x: 0,
						y: mousePos - this.thickness / 2
					});
				}
			}
		}

		render():JSX.Element
		{
			var style:React.CSSProperties = _.merge(
				{
					zIndex: 1, // temporary hack?
					left: this.state.x,
					top: this.state.y,
					visibility: this.state.active ? "visible" : "hidden"
				},
				STYLE_BASE
			);
			if (this.props.direction == HORIZONTAL)
			{
				(style as any).cursor = "col-resize";
				style.width = this.thickness || Resizer.DEFAULT_SPACING;
				style.height = "100%";
			}
			else
			{
				(style as any).cursor = "row-resize";
				style.width = "100%";
				style.height = this.thickness || Resizer.DEFAULT_SPACING;
			}
			return <span style={prefixer(style)}/>;
		}
	}
}
