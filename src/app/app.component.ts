import { JsonPipe } from "@angular/common";
import { Component, ViewChild, ElementRef } from "@angular/core";
import * as d3 from "d3";
import { numberFormat } from "highcharts";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent {
  title = "ng-d3-graph-editor";
  @ViewChild("graphContainer") graphContainer: ElementRef;

  width = 960;
  height = 600;
  colors = d3.scaleOrdinal(d3.schemeCategory10);

  svg: any;
  force: any;
  path: any;
  circle: any;
  drag: any;
  dragLine: any;
  // isNodeSelected = false;

  // mouse event vars
  selectedNode = null;
  selectedLink = null;
  mousedownLink = null;
  mousedownNode = null;
  mouseupNode = null;

  lastNodeId = 0;
  // only respond once per keydown
  lastKeyDown = -1;

  nodes = [
    { id: 0, reflexive: true, children: 2, isOpen: false, parentID: null,child:[] },
  ];
  links = [];

  ngAfterContentInit() {
    const rect = this.graphContainer.nativeElement.getBoundingClientRect();
    console.log(rect.width, rect.height);

    this.width = rect.width;

    this.svg = d3
      .select("#graphContainer")
      .attr("oncontextmenu", "return false;")
      .attr("width", this.width)
      .attr("height", this.height);

    this.force = d3
      .forceSimulation()
      .force(
        "link",
        d3
          .forceLink()
          .id((d: any) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("x", d3.forceX(this.width / 2))
      .force("y", d3.forceY(this.height / 2))
      .on("tick", () => this.tick());

    // init D3 drag support
    this.drag = d3
      .drag()
      .on("start", (d: any) => {
        if (!d3.event.active) this.force.alphaTarget(0.3).restart();

        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (d: any) => {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
      })
      .on("end", (d: any) => {
        if (!d3.event.active) this.force.alphaTarget(0.3);

        d.fx = null;
        d.fy = null;
      });

    // define arrow markers for graph links
    this.svg
      .append("svg:defs")
      .append("svg:marker")
      .attr("id", "end-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 6)
      .attr("markerWidth", 3)
      .attr("markerHeight", 3)
      .attr("orient", "auto")
      .append("svg:path");
    this.svg
      .append("svg:defs")
      .append("svg:marker")
      .attr("id", "start-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 4)
      .attr("markerWidth", 3)
      .attr("markerHeight", 3)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M10,-5L0,0L10,5")
      .attr("fill", "#000");

    // line displayed when dragging new nodes
    this.dragLine = this.svg
      .append("svg:path")
      .attr("class", "link dragline hidden")
      .attr("d", "M0,0L0,0");

    // handles to link and node element groups
    this.path = this.svg.append("svg:g").selectAll("path");
    this.circle = this.svg.append("svg:g").selectAll("g");

    // app starts here
    d3.select(window).on("keydown", this.keydown).on("keyup", this.keyup);
    this.restart();
  }

  // update force layout (called automatically each iteration)
  tick() {
    // draw directed edges with proper padding from node centers
    this.path.attr("d", (d: any) => {
      const deltaX = d.target.x - d.source.x;
      const deltaY = d.target.y - d.source.y;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const normX = deltaX / dist;
      const normY = deltaY / dist;
      const sourcePadding = d.left ? 17 : 12;
      const targetPadding = d.right ? 17 : 12;
      const sourceX = d.source.x + sourcePadding * normX;
      const sourceY = d.source.y + sourcePadding * normY;
      const targetX = d.target.x - targetPadding * normX;
      const targetY = d.target.y - targetPadding * normY;

      return `M${sourceX},${sourceY}L${targetX},${targetY}`;
    });

    this.circle.attr("transform", (d) => `translate(${d.x},${d.y})`);
  }

  resetMouseVars() {
    this.mousedownNode = null;
    this.mouseupNode = null;
    this.mousedownLink = null;
  }

  // update graph (called when needed)
  restart() {
    // path (link) group
    this.path = this.path.data(this.links);

    // update existing links
    this.path
      .classed("selected", (d) => d === this.selectedLink)
      .style("marker-start", (d) => (d.left ? "url(#start-arrow)" : ""))
      .style("marker-end", (d) => (d.right ? "url(#end-arrow)" : ""));

    // remove old links
    this.path.exit().remove();

    // add new links
    this.path = this.path
      .enter()
      .append("svg:path")
      .attr("class", "link")
      .classed("selected", (d) => d === this.selectedLink)
      .style("marker-start", (d) => (d.left ? "url(#start-arrow)" : ""))
      .style("marker-end", (d) => (d.right ? "url(#end-arrow)" : ""))
      .on("mousedown", (d) => {
        if (d3.event.ctrlKey) return;

        // select link
        this.mousedownLink = d;
        this.selectedLink =
          this.mousedownLink === this.selectedLink ? null : this.mousedownLink;
        this.selectedNode = null;
        this.restart();
      })
      .merge(this.path);

    // circle (node) group
    // NB: the function arg is crucial here! nodes are known by id, not by index!
    this.circle = this.circle.data(this.nodes, (d) => d.id);

    // update existing nodes (reflexive & selected visual states)
    this.circle
      .selectAll("circle")
      .style("fill", (d) =>
        d === this.selectedNode
          ? d3.rgb(this.colors(d.id)).brighter().toString()
          : this.colors(d.id)
      )
      .classed("reflexive", (d) => d.reflexive);

    // remove old nodes
    this.circle.exit().remove();

    // add new nodes
    const g = this.circle.enter().append("svg:g");

    g.append("svg:circle")
      .attr("class", "node")
      .attr("r", 12)
      .style("fill", (d) =>
        d === this.selectedNode
          ? d3.rgb(this.colors(d.id)).brighter().toString()
          : this.colors(d.id)
      )
      .style("stroke", (d) => d3.rgb(this.colors(d.id)).darker().toString())
      .classed("reflexive", (d) => d.reflexive)
      .on("mouseover", function (d) {
        if (!this.mousedownNode || d === this.mousedownNode) return;
        // enlarge target node
        d3.select(this).attr("transform", "scale(1.1)");
      })
      .on("mouseout", function (d) {
        if (!this.mousedownNode || d === this.mousedownNode) return;
        // unenlarge target node
        d3.select(this).attr("transform", "");
      })
      .on("mousedown", (d) => {
        if (d3.event.ctrlKey) return;

        // select node
        this.mousedownNode = d;
        this.selectedNode =
          this.mousedownNode === this.selectedNode ? null : this.mousedownNode;
        console.log("node selected : id = " + this.selectedNode.id);
        if (this.selectedNode.isOpen === false) {
          this.isChild(this.selectedNode);
        } else {
          this.closeChild(this.selectedNode);
        }

        this.selectedLink = null;

        // this.dragLine
        //   .style("marker-end", "url(#end-arrow)")
        //   .classed("hidden", false)
        //   .attr(
        //     "d",
        //     `M${this.mousedownNode.x},${this.mousedownNode.y}L${this.mousedownNode.x},${this.mousedownNode.y}`
        //   );

        this.restart();
      })
      .on("mouseup", (dataItem: any) => {
        debugger;
        if (!this.mousedownNode) return;

        // needed by FF
        this.dragLine.classed("hidden", true).style("marker-end", "");

        // check for drag-to-self
        this.mouseupNode = dataItem;
        if (this.mouseupNode === this.mousedownNode) {
          this.resetMouseVars();
          return;
        }

        // unenlarge target node
        d3.select(d3.event.currentTarget).attr("transform", "");

        // add link to graph (update if exists)
        // NB: links are strictly source < target; arrows separately specified by booleans
        const isRight = this.mousedownNode.id < this.mouseupNode.id;
        const source = isRight ? this.mousedownNode : this.mouseupNode;
        const target = isRight ? this.mouseupNode : this.mousedownNode;

        const link = this.links.filter(
          (l) => l.source === source && l.target === target
        )[0];
        if (link) {
          link[isRight ? "right" : "left"] = true;
        } else {
          this.links.push({ source, target, left: !isRight, right: isRight });
        }

        // select new link
        this.selectedLink = link;
        this.selectedNode = null;
        this.restart();
      });

    // show node IDs
    g.append("svg:text")
      .attr("x", 0)
      .attr("y", 4)
      .attr("class", "id")
      .text((d) => d.id);

    this.circle = g.merge(this.circle);

    // set the graph in motion
    this.force.nodes(this.nodes).force("link").links(this.links);

    this.force.alphaTarget(0.3).restart();
  }
  spliceLinksForNode(node) {
    const toSplice = this.links.filter(
      (l) => l.source === node || l.target === node
    );
    for (const l of toSplice) {
      this.links.splice(this.links.indexOf(l), 1);
    }
  }

  keydown() {
    d3.event.preventDefault();

    if (this.lastKeyDown !== -1) return;
    this.lastKeyDown = d3.event.keyCode;

    // ctrl
    if (d3.event.keyCode === 17) {
      this.circle.call(this.drag);
      this.svg.classed("ctrl", true);
    }

    if (!this.selectedNode && !this.selectedLink) return;

    switch (d3.event.keyCode) {
      case 8: // backspace
      case 46: // delete
        if (this.selectedNode) {
          this.nodes.splice(this.nodes.indexOf(this.selectedNode), 1);
          this.spliceLinksForNode(this.selectedNode);
        } else if (this.selectedLink) {
          this.links.splice(this.links.indexOf(this.selectedLink), 1);
        }
        this.selectedLink = null;
        this.selectedNode = null;
        this.restart();
        break;
      case 66: // B
        if (this.selectedLink) {
          // set link direction to both left and right
          this.selectedLink.left = true;
          this.selectedLink.right = true;
        }
        this.restart();
        break;
      case 76: // L
        if (this.selectedLink) {
          // set link direction to left only
          this.selectedLink.left = true;
          this.selectedLink.right = false;
        }
        this.restart();
        break;
      case 82: // R
        if (this.selectedNode) {
          // toggle node reflexivity
          this.selectedNode.reflexive = !this.selectedNode.reflexive;
        } else if (this.selectedLink) {
          // set link direction to right only
          this.selectedLink.left = false;
          this.selectedLink.right = true;
        }
        this.restart();
        break;
    }
  }

  isChild(selectedNode: any) {
    if (selectedNode.children > 0) {
      this.selectedNode.isOpen = true;
      let parentID = this.selectedNode.id;
      for (let i = 0; i < selectedNode.children; i++) {
        this.selectedNode.child[i]=this.lastNodeId+1;
        const node = {
          id: ++this.lastNodeId,
          reflexive: false,
          children: 2,
          isOpen: false,
          parentID: parentID,
          child: []
        };
        this.nodes.push(node);
        const source = selectedNode.id;
        const target = node.id;
        // const link = this.links.filter((l) => l.source === selectedNode.id && l.target === node.id)[0];
        console.log("links"+  this.links);
        this.links.push({ source, target, right: true });
      }
      console.log(
        "Hello  this is a array of node" + JSON.stringify(this.nodes)
      );
    } else {
      console.log("This node is child node ");
    }
  }

  closeChild(selectedNode: any) { 
    console.log(this.links);
    this.selectedNode.isOpen = false;
    
    // selectedNode.children = 0;
    for(let i=0; i<this.nodes.length; i++) {
      this.nodes=this.nodes.filter(item => !(this.nodes[i].id === selectedNode.parentID));
      // this.links=this.links.filter(item => !(this.));
      // this.selectedNode.child.pop();
     // this.nodes.pop();
      // this.links.pop();
      this.lastNodeId -= 1;
    }
    console.log(
      "Hello  this is a array of node" + JSON.stringify(this.nodes)
    );
  }
  
  keyup() {
    this.lastKeyDown = -1;

    // ctrl
    if (d3.event.keyCode === 17) {
      this.circle.on(".drag", null);
      this.svg.classed("ctrl", false);
    }
  }
}
