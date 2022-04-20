//pseudo-global variables
var attrArray = ["happiness", "logged_ppp", "social_spt", "life_exp", "choice", "generous", "corruption"];
var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.6,
        height = 460;
    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoEqualEarth()
        .scale(120)
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
        console.log(colorScale.thresholds)
        //add enumeration units to the map
        setEnumerationUnits(country, map, path, colorScale);

        // addLegend

        //add coordinated visualization to the map
        setChart(csvData, colorScale);
    
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
        var csvKey = csvCountry.country; //the CSV primary key

        //loop through geojson regions to find correct country
        for (var a=0; a<country.length; a++){

            var geojsonProps = country[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.country; //the geojson primary key

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
    //assign two-value array as scale domain
    colorScale.domain(minmax);

    return colorScale;
};

function setEnumerationUnits(country, map,path, colorScale){    
    var happyCountries = map.selectAll(".country")        
        .data(country)        
        .enter()        
        .append("path")        
        .attr("class", function(d){           
            return "country " + d.properties.country;        
        })        
        .attr("d", path)        
            .style("fill", function(d){            
                var value = d.properties[expressed];  
                // console.log(value)          
                if(value) {                
                    return colorScale(d.properties[expressed]);            
                } else {                
                    return "#ccc";            
                }    
        });

};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    var data = []
    for (var i=0; i<csvData.length; i++){
        data.push(parseFloat(csvData[i][expressed]))
    }

    //chart frame dimensions
    var margin = { top: 5, right: 10, bottom: 20, left: 30 },
        chartWidth = window.innerWidth * 0.35 - margin.left - margin.right,
        chartHeight = 200 - margin.top - margin.bottom;

    //create a second svg element to hold the histogram
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .attr("class", "chart")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    step = 0.5
        //build two-value array of minimum and maximum expressed attribute values
    var min = Math.floor(d3.min(data)/step)/2,
        max = Math.ceil(d3.max(data)/step)/2;
    
    var xScale = d3.scaleLinear()
            .domain([min, max])
            .range([0, chartWidth]);

    var nBin = Math.round((max-min)/0.5)+1

    var thresholds = []
    for (var i=1; min+i*step<max; i++){
        thresholds.push(min+i*step)
    }
    console.log(thresholds)
   
    // console.log(xScale.nice().ticks(nBin-1))
    // build the histogram function
    var hist = d3.histogram()
        .domain(xScale.domain()) // then the domain of the graphic
        .thresholds(thresholds); // then the numbers of bins

    console.log(data)
    // And apply this function to data to get the bins
    var bins = hist(data);
    console.log(bins) //x0: left, x1: right, length:number of elements

    // add the x-axis 
    chart.append("g")
        .attr("transform", "translate(0," + chartHeight + ")")
        .call(d3.axisBottom(xScale));
    
    // add y-axis
    var yScale = d3.scaleLinear()
        .range([chartHeight, 20])
        .domain([
            0,
            d3.max(bins, function(d) {
            return d.length;
            })
        ]);
    
    chart.append("g").call(d3.axisLeft(yScale));
    
    // append the bar rectangles
    chart.selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", 1)
        .attr("transform", function(d) {
            return "translate(" + xScale(d.x0) + "," + yScale(d.length) + ")";
        })
        .attr("width", function(d) {
            return xScale(d.x1) - xScale(d.x0) - 1;
        })
        .attr("height", function(d) {
            return chartHeight - yScale(d.length);
        })
        .style("fill", function(d){
            return colorScale((d.x0 + d.x1)/2);
        });

    var chartTitle = chart.append("text")
        .attr("x", 2)
        .attr("y", 10)
        .attr("class", "chartTitle")
        .text("Distribution of " + expressed + " in each country");
};
