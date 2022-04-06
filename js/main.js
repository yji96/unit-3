//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoEqualEarth()
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    //use Promise.all to parallelize asynchronous data loading
    var promises = [d3.csv("data/happiness.csv"),                    
                    d3.json("data/happiness_polygon.topojson")                  
                    ];    
    Promise.all(promises).then(callback);

    function callback(data){    
        csvData = data[0];    
        world = data[1];    
        console.log(csvData);
        console.log(world); 
        
        //translate europe TopoJSON
        var world = topojson.feature(world, world.objects.happiness_polygon).features;
        //add Europe countries to map
        //add France regions to map

        var countries = map.selectAll(".country")
            .data(world)
            .enter()
            .append("path")
            .attr("class", "countries")
            .attr("d", path);

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

    };
};