//pseudo-global variables
var attrArray = ["Happiness score","Logged GDP per capita", "Social support", "Life expectancy", "Freedom to make choices", "Generosity", "Perceptions of corruption"]
// ["happiness", "logged_ppp", "social_support", "life_expectancy", "free_choice", "Generosity", "corruption"];
var expressed = attrArray[0]; //initial attribute

//map frame dimensions
var width = 800,
    height = 380;
//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    var title = d3.select("body")
        .append("text")
        .attr("class", "title")
        .text("Are all the countries happy in 2020?");
        // .attr("y", 20)
        // .attr("x", 100);

    //create new svg container for the map
    var map = d3.select("#mapPanel")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    

    
    //create Albers equal area conic projection centered on France
    var projection = d3.geoEqualEarth()
        // .scale(10)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    //use Promise.all to parallelize asynchronous data loading
    var promises = [d3.csv("data/happiness.csv"),   
                    d3.json("data/country.topojson"),                 
                    d3.json("data/world.topojson")                  
                    ];    
    Promise.all(promises).then(callback);

    function callback(data){    
        csvData = data[0];   
        country = data[1]; 
        world = data[2];    
        console.log(csvData);
        console.log(country)
        console.log(world); 
        
        //place graticule on the map
        setGraticule(map, path);

        //translate country TopoJSON
        var country = topojson.feature(country, country.objects.country).features,
            world = topojson.feature(world, world.objects.ne_50m_admin_0_countries)
        
        //add all countries as basemap
        var worldCountries = map.append("path")
            .datum(world)
            .attr("class", "basemap")
            .attr("d", path);


        //join csv data to GeoJSON enumeration units
        country = joinData(country, csvData);

        colorScale = makeColorScale(csvData)
        // console.log(colorScale.thresholds)
        //add enumeration units to the map
        setEnumerationUnits(country, map, path, colorScale);

        // add legend
        setLegend(csvData, map, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        //add dropdown
        createDropdown(csvData)

        var metaData = "<p>Data Source: The World Happiness Report 2021, Natural Earth<br>" +
                        "Projection: Equal Earth<p>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "metadata")
            .html(metaData);

    
    };
};

function setGraticule(map, path){
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([15, 15]); //place graticule lines every 5 degrees of longitude and latitude


    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines    
}

function joinData(country, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvCountry = csvData[i]; //the current region
        var csvKey = csvCountry.cid; //the CSV primary key

        //loop through geojson regions to find correct country
        for (var a=0; a<country.length; a++){

            var geojsonProps = country[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.cid; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvCountry[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
            // console.log(geojsonProps)
        };
    };    
    return country
}



//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "rgba(241,238,246,.7)",
        "rgba(189,201,225,.7)",
        "rgba(116,169,207,.7)",
        "rgba(43,140,190,.7)",
        "rgba(4,90,141,.7)",
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build two-value array of minimum and maximum expressed attribute values
    var minmax = [
        d3.min(data, function(d) { return parseFloat(d[expressed]); }),
        d3.max(data, function(d) { return parseFloat(d[expressed]); })
    ];

    var attr_data = []
    for (var i=0; i<csvData.length; i++){
        attr_data.push(parseFloat(csvData[i][expressed]))
    }
    //assign two-value array as scale domain
    colorScale.domain(attr_data)//minmax);

    return colorScale;
};

function setEnumerationUnits(country, map,path, colorScale){    
    var happyCountries = map.selectAll(".country")        
        .data(country)        
        .enter()        
        .append("path")        
        .attr("class", function(d){           
            return "country " + d.properties.cid;        
        })        
        .attr("d", path)        
        .style("fill", function(d){            
            var value = d.properties[expressed];           
            if(value) {                
                return colorScale(d.properties[expressed]);            
            } else {                
                return "#ccc";            
            }    
        })
        .on("mouseover", function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    var desc = happyCountries.append("desc")
    .       text('{"stroke": "#000", "stroke-width": "0.5px"}');
    // console.log(d3.selectAll(".country"))
};

function setLegend(csvData, map, colorScale){

    var legendElementWidth = 30,
        legendElementHeight = 20;
    
    var breakPoints = [d3.min(csvData, function(d) { 
        // console.log(d[expressed])
        return parseFloat(d[expressed]); })]
    // console.log(breakPoints)
    for (var i=0; i<colorScale.quantiles().length; i++){
        breakPoints.push(parseFloat(colorScale.quantiles()[i]))
    };
    // console.log(breakPoints);

    var legend = map.selectAll(".legend")
        .data(breakPoints)
        .enter().append("g")
        .attr("class", "legend");


    legend.append("rect")
        .attr("class", "legendRect")
        .attr("y", function(d, i) { 
            return height - legendElementHeight * (8 - i); 
        })
        .attr("x", 30)
        .attr("width", legendElementWidth)
        .attr("height", legendElementHeight)
        .style("fill", function(d, i) { return colorScale(d); });

    legend.append("text")
        .attr("class", "mono")
        .text(function(d, i) { 
            if (i<breakPoints.length-1){
                return breakPoints[i].toFixed(2) + ' - ' + breakPoints[i+1].toFixed(2);
            }
            else{
                return '> ' + breakPoints[i].toFixed(2);
            }
             
        })
        .attr("y", function(d, i) { 
            return height - legendElementHeight * (7.2 - i); 
        })
        .attr("x", 65);
}

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    var data = []
    for (var i=0; i<csvData.length; i++){
        data.push(parseFloat(csvData[i][expressed]))
    }

    //chart frame dimensions
    var margin = { top: 20, right: 10, bottom: 20, left: 30 },
        chartWidth = 800 - margin.left - margin.right,
        chartHeight = 300 - margin.top - margin.bottom;

    //create a second svg element to hold the histogram
    var chart = d3.select("#panel")
        .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .attr("class", "chart")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // For each attr, build a linear scale. I store all in a y object
    var y = {}
    for (i in attrArray) {
        attr = attrArray[i]
        y[attr] = d3.scaleLinear()
        .domain( d3.extent(csvData, function(d) { return +d[attr]; }) )
        .range([chartHeight, 0])
    }

      // Build the X scale -> it find the best position for each Y axis
    var x = d3.scalePoint()
        .range([0, chartWidth-10])
        .padding(0.4)
        .domain(attrArray);
    
    // The path function take a row of the csv as input, and return x and y coordinates of the line to draw for this raw.
    function path(d) {
        return d3.line()(attrArray.map(function(p) { return [x(p), y[p](d[p])]; }));
    }

    var lines = chart.selectAll(".line")
        .data(csvData)
        .enter()
        .append("path")
        .attr("class", function(d){    
            // console.log(d)       
            return "line " + d.cid;        
        })     
        .attr("d", path)   
        .style("fill", "none")
        .style("stroke", function(d){          
            var value = d[expressed];  
            // console.log(value)          
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }  
        })  
        .style("stroke-width", .5)
        .style("opacity", .9)
        .on("mouseover", function(event, d){
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);

    //add style descriptor to each rect
    var desc = lines.append("desc")
                .text('{"stroke": "none", "stroke-width": "0px"}');
    // console.log(d3.selectAll(".line"))
    // Draw the axis:
    
    chart.selectAll("myAxis")
        // For each dimension of the dataset I add a 'g' element:
        .data(attrArray)
        .enter()
        .append("g")
        // I translate this element to its right position on the x axis
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        // And I build the axis with the call function
        .each(function(d) { d3.select(this).call(d3.axisLeft().scale(y[d])); })
        // Add axis title
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(function(d) { return d; })
        .style("fill", "black")

    // var chartTitle = chart.append("text")
    //     .attr("x", 2)
    //     .attr("y", 10)
    //     .attr("class", "chartTitle")
    //     .text("Distribution of " + expressed + " in each country");
};


//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var happyCountries = d3.selectAll(".country")
        .transition()
        .duration(100)
        .style("fill", function(d){            
            var value = d.properties[expressed];            
            if(value) {                
                return colorScale(value);           
            } else {                
                return "#ccc";            
            }    
    });

    // update legend
    var breakPoints = [d3.min(csvData, function(d) { return parseFloat(d[expressed]); })]
    for (var i=0; i<colorScale.quantiles().length; i++){
        breakPoints.push(parseFloat(colorScale.quantiles()[i]))
    };
    console.log(breakPoints);

    var mono = d3.selectAll(".mono")
        .text(function(d, i) { 
            if (i<breakPoints.length-1){
                return breakPoints[i].toFixed(2) + ' - ' + breakPoints[i+1].toFixed(2);
            }
            else{
                return '> ' + breakPoints[i].toFixed(2);
            }
             
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(50);

    // change color in PCP 
    var lines = d3.selectAll(".line")
        // .transition()
        // .duration(500)
        .style("fill", "none")
        .style("stroke", function(d){         
            var value = d[expressed];  
            // console.log(value)          
            if(value) {      
                // console.log(colorScale(value))       
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }  
        })  
        .style("stroke-width", .5)
        .style("opacity", .9)
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(50);
        
    // console.log(expressed)
}

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.cid)
        .style("stroke", "#0FC2C0")
        .style("stroke-width", "2");

    setLabel(props)
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.cid)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    d3.select(".infolabel")
    .remove();
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.cid + "_label")
        .html(labelAttribute);

    var countryName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.country);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};